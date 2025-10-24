import { mdiMapMarkerAlertOutline, mdiMapMarkerRemoveVariant } from '@mdi/js';
import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug, debugTime } from '../modules/debug';
import { addStylesheet } from '../modules/document';
import { el } from '../modules/html';
import { createInfoIcon } from '../modules/info-icon';
import { Messenger } from '../modules/message';
import { getFastLookupPalette } from '../modules/pxls-palette';
import { getCurrentTemplate, TEMPLATE_CHANGE_EVENT_NAME, type TemplateData } from '../modules/pxls-template';
import {
    getPxlsUIBoard,
    getPxlsUIBoardContainer,
    getPxlsUIHeatmapBoard,
    getPxlsUIVirginmapBoard,
    waitForBoardLoaded,
    waitForHeatmapLoaded,
    waitForVirginmapLoaded,
} from '../modules/pxls-ui';
import { BooleanSetting, SettingBase, Settings, type SettingUpdateCallback } from '../modules/settings';
import {
    createBooleanSetting,
    createSelectSetting,
    createSettingsButton,
    createSettingsResetButton,
    createSettingsUI,
} from '../modules/settings-ui';
import { detemplatizeImage, getTemplateImage } from '../modules/template';
import { bindWebSocketProxy, PIXEL_PLACED_EVENT_NAME, type PlacedPixelData } from '../modules/websocket';
import type { PxlsApp } from '../pxls/pxls-global';
import griefTrackerStyles from './grief-tracker.user.css';
import { PxlsUserscript } from './userscript';

const griefDetectionModesSchema = v.picklist(['everything', 'nonVirginOnly', 'recentOnly', 'newOnly']);
type GriefDetectionMode = InferOutput<typeof griefDetectionModesSchema>;

const griefAnimationStyleSchema = v.picklist(['rgbwFlashVeryThick', 'rgbwFlashThick', 'rgbwFlashThin']);
type GriefAnimationStyle = InferOutput<typeof griefAnimationStyleSchema>;

const griefAnimationSpeedSchema = v.picklist(['verySlow', 'slow', 'fast']);
type GriefAnimationSpeed = InferOutput<typeof griefAnimationSpeedSchema>;

const GRIEF_ANIMATION_SPEED_MAP: Record<GriefAnimationSpeed, number> = {
    verySlow: 2000,
    slow: 1000,
    fast: 500,
};

const GRIEF_STYLE_PIXEL_SIZE_MAP: Record<GriefAnimationStyle, number> = {
    rgbwFlashVeryThick: 1,
    rgbwFlashThick: 2,
    rgbwFlashThin: 4,
};

const GRIEF_ANIMATION_COLORS = ['#ff0000', '#00ff00', '#0080ff', '#ffffff'];

class GriefDetectionModeSetting extends SettingBase<GriefDetectionMode, string> {
    constructor(
        defaultValue: GriefDetectionMode,
        valueUpdateCallbacks: SettingUpdateCallback<GriefDetectionMode>[] = [],
    ) {
        super(defaultValue, griefDetectionModesSchema, valueUpdateCallbacks);
    }

    override serializeValue(value: GriefDetectionMode): string {
        return value;
    }
}

class GriefAnimationStyleSetting extends SettingBase<GriefAnimationStyle, string> {
    constructor(
        defaultValue: GriefAnimationStyle,
        valueUpdateCallbacks: SettingUpdateCallback<GriefAnimationStyle>[] = [],
    ) {
        super(defaultValue, griefAnimationStyleSchema, valueUpdateCallbacks);
    }

    override serializeValue(value: GriefAnimationStyle): string {
        return value;
    }
}

class GriefAnimationSpeedSetting extends SettingBase<GriefAnimationSpeed, string> {
    constructor(
        defaultValue: GriefAnimationSpeed,
        valueUpdateCallbacks: SettingUpdateCallback<GriefAnimationSpeed>[] = [],
    ) {
        super(defaultValue, griefAnimationSpeedSchema, valueUpdateCallbacks);
    }

    override serializeValue(value: GriefAnimationSpeed): string {
        return value;
    }
}

interface GriefTrackerTemplateContext {
    template: TemplateData;
    detemplatizedImage: ImageData;
    detemplatizedImageUint32View: Uint32Array;
}

export class GriefTrackerScript extends PxlsUserscript {
    private readonly messenger = new Messenger('Grief tracker');

    private readonly settings = Settings.create('griefTracker', {
        enabled: new BooleanSetting(true, [
            (_, newValue): void => {
                this.griefsCanvas.classList.toggle('dpus__grief-tracker--hidden', !newValue);
                if (newValue) {
                    if (this.templateContext) {
                        this.infoIcon.setState('templateActive');
                    } else {
                        this.infoIcon.setState('default');
                    }
                } else {
                    this.infoIcon.setState('disabled');
                }
            },
        ]),
        detectionMode: new GriefDetectionModeSetting('recentOnly', [
            (_, newValue): void => {
                this.clearGriefList();
                if (newValue !== 'newOnly') {
                    this.collectExistingGriefs();
                }
            },
        ]),
        animationStyle: new GriefAnimationStyleSetting('rgbwFlashThin', [
            (): void => {
                this.updateCachedGriefPixel();
                this.collectExistingGriefs();
            },
        ]),
        animationSpeed: new GriefAnimationSpeedSetting('slow'),
        showClearGriefsButton: new BooleanSetting(true, [
            (_, newValue): void => {
                this.clearGriefsIcon.toggleHidden(!newValue);
            },
        ]),
        renderUnderTemplate: new BooleanSetting(false, [
            (_, newValue): void => {
                this.griefsCanvas.classList.toggle('dpus__grief-tracker--under-template', newValue);
            },
        ]),
    });

    private palette: number[] = [];

    private heatmapTimerId: number | null = null;

    private templateContext: GriefTrackerTemplateContext | null = null;

    private readonly griefPixel: OffscreenCanvas;
    private readonly griefPixelCtx: OffscreenCanvasRenderingContext2D;
    private readonly griefsCanvas = el('canvas', { class: 'dpus__grief-tracker' });
    private readonly griefsCtx: CanvasRenderingContext2D;
    private readonly griefedPixels = new Set<string>();

    private lastRenderedHighlightColorIndex = 0;
    private animationFrameRequestId: number | null = null;

    private readonly infoIcon = createInfoIcon('Grief Tracker', mdiMapMarkerAlertOutline, {
        clickable: true,
        states: [
            { key: 'default', color: 'white', title: 'Idle' },
            { key: 'disabled', color: 'gray', title: 'Disabled (click to enable)' },
            { key: 'templateActive', color: 'green', title: 'Template active (click to disable)' },
            { key: 'loadingBoard', color: 'yellow', title: 'Loading board and virginmap' },
            { key: 'loadingTemplate', color: 'orange', title: 'Loading template' },
            { key: 'error', color: 'red' },
        ],
    });

    private readonly clearGriefsIcon = createInfoIcon('Grief Tracker', mdiMapMarkerRemoveVariant, {
        clickable: true,
        states: [{ key: 'default', color: 'white', title: 'Clear griefs' }],
    });

    constructor() {
        super(
            'Grief Tracker',
            () => {
                this.initBeforeApp();
            },
            async (app) => this.initAfterApp(app),
        );

        const griefsCtx = this.griefsCanvas.getContext('2d');
        if (!griefsCtx) {
            throw new Error('Failed to get griefs canvas context');
        }
        griefsCtx.clearRect(0, 0, this.griefsCanvas.width, this.griefsCanvas.height);
        this.griefsCtx = griefsCtx;

        this.griefPixel = new OffscreenCanvas(1, 1);
        const griefPixelCtx = this.griefPixel.getContext('2d');
        if (!griefPixelCtx) {
            throw new Error('Failed to get grief pixel canvas context');
        }
        this.griefPixelCtx = griefPixelCtx;
        this.updateCachedGriefPixel();

        this.infoIcon.element.addEventListener('click', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
                return;
            }

            if (e.button === 0) {
                this.settings.enabled.set(!this.settings.enabled.get());
            }
        });

        this.clearGriefsIcon.element.addEventListener('click', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
                return;
            }

            if (e.button === 0) {
                this.clearGriefList();
            }
        });
    }

    private get griefPixelSize(): number {
        return GRIEF_STYLE_PIXEL_SIZE_MAP[this.settings.animationStyle.get()];
    }

    private get griefPixelOverlaySize(): number {
        return this.griefPixelSize + 2;
    }

    private initSettings(): void {
        const { settings } = this;
        createSettingsUI('griefTracker', 'DPUS Grief Tracker', () => [
            createBooleanSetting(settings.enabled, 'Highlight griefs'),
            createSelectSetting(settings.detectionMode, 'Grief detection mode', [
                { value: 'everything', label: 'Everything', title: 'Every incorrect pixel is highlighted' },
                {
                    value: 'nonVirginOnly',
                    label: 'Non-virgin only',
                    title: 'Only non-virgin incorrect pixels are highlighted',
                },
                {
                    value: 'recentOnly',
                    label: 'Recent only',
                    title: 'Only incorrect pixels that are active on the heatmap are highlighted',
                },
                {
                    value: 'newOnly',
                    label: 'New only',
                    title: 'No incorrect pixels are highlighted by default, only new incorrect pixels are highlighted',
                },
            ]),
            createSelectSetting(settings.animationStyle, 'Animation style', [
                { value: 'rgbwFlashVeryThick', label: 'RGBW flash (very thick)', title: 'Visible up to zoom 0.5' },
                { value: 'rgbwFlashThick', label: 'RGBW flash (thick)', title: 'Visible up to zoom 1' },
                { value: 'rgbwFlashThin', label: 'RGBW flash (thin)', title: 'Visible up to zoom 2' },
            ]),
            createSelectSetting(settings.animationSpeed, 'Animation speed', [
                { value: 'verySlow', label: 'Very slow', title: '2 seconds per animation frame' },
                { value: 'slow', label: 'Slow', title: '1 second per animation frame' },
                { value: 'fast', label: 'Fast', title: '500 milliseconds per animation frame' },
            ]),
            createBooleanSetting(settings.showClearGriefsButton, 'Show "Clear griefs" icon button'),
            createBooleanSetting(settings.renderUnderTemplate, 'Render griefs under template'),
            createSettingsButton('Clear griefs', () => {
                this.clearGriefList();
            }),
            createSettingsResetButton(settings),
        ]);
    }

    private initEventListeners(): void {
        document.body.addEventListener('keydown', (event) => {
            if (event.key === 'y') {
                if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
                    return;
                }

                this.clearGriefList();
            }
        });

        window.addEventListener(PIXEL_PLACED_EVENT_NAME, ({ detail: { pixels } }) => {
            if (!this.templateContext) {
                return;
            }

            for (const pixel of pixels) {
                this.pixelPlaced(pixel);
            }
        });

        window.addEventListener(TEMPLATE_CHANGE_EVENT_NAME, ({ detail: template }) => {
            if (template) {
                this.templateChanged(template);
            } else {
                if (this.templateContext) {
                    this.clearTemplate();
                }
            }
        });
    }

    private updateCachedGriefPixel(): void {
        const pixelSize = this.griefPixelOverlaySize;
        this.griefPixel.width = pixelSize;
        this.griefPixel.height = pixelSize;

        const ctx = this.griefPixelCtx;
        ctx.clearRect(0, 0, pixelSize, pixelSize);

        ctx.fillStyle = GRIEF_ANIMATION_COLORS[this.lastRenderedHighlightColorIndex];
        ctx.fillRect(0, 0, pixelSize, pixelSize);
        ctx.clearRect(1, 1, pixelSize - 2, pixelSize - 2);
    }

    private updateGriefsCanvasSize(width: number, height: number): void {
        const { width: oldWidth, height: oldHeight } = this.griefsCanvas;
        this.griefsCtx.clearRect(0, 0, oldWidth, oldHeight);

        const pixelSize = this.griefPixelSize;
        this.griefsCanvas.width = width * pixelSize;
        this.griefsCanvas.height = height * pixelSize;
    }

    private coordToMapKey(x: number, y: number): string {
        return `${x},${y}`;
    }

    private addGriefs(griefs: [number, number][]): void {
        for (const [x, y] of griefs.values()) {
            this.addGrief(x, y);
        }
    }

    private addGrief(x: number, y: number): void {
        debug('New grief at', x, y);

        const key = this.coordToMapKey(x, y);
        if (this.griefedPixels.has(key)) {
            return;
        }

        this.addGriefUnchecked(x, y);
    }

    private addGriefUnchecked(x: number, y: number): void {
        const key = this.coordToMapKey(x, y);
        const pixelSize = this.griefPixelSize;
        const pixelOverlaySize = this.griefPixelOverlaySize;
        this.griefsCtx.drawImage(
            this.griefPixel,
            x * pixelSize - 1,
            y * pixelSize - 1,
            pixelOverlaySize,
            pixelOverlaySize,
        );
        this.griefedPixels.add(key);
    }

    private removeGrief(x: number, y: number): void {
        const key = this.coordToMapKey(x, y);
        this.griefedPixels.delete(key);

        const pixelSize = this.griefPixelSize;
        const pixelOverlaySize = this.griefPixelOverlaySize;
        this.griefsCtx.clearRect(x * pixelSize - 1, y * pixelSize - 1, pixelOverlaySize, pixelOverlaySize);

        // add back neighboring griefs to cover up any gaps
        const refreshDistance = this.settings.animationStyle.get() === 'rgbwFlashVeryThick' ? 2 : 1;
        for (let offsetY = -refreshDistance; offsetY <= refreshDistance; offsetY++) {
            for (let offsetX = -refreshDistance; offsetX <= refreshDistance; offsetX++) {
                const neighborX = x + offsetX;
                const neighborY = y + offsetY;
                if (this.griefedPixels.has(this.coordToMapKey(neighborX, neighborY))) {
                    this.addGriefUnchecked(neighborX, neighborY);
                }
            }
        }
    }

    private clearGriefList(): void {
        this.griefedPixels.clear();
        const { width, height } = this.griefsCanvas;
        this.griefsCtx.clearRect(0, 0, width, height);
        if (this.heatmapTimerId != null) {
            window.clearTimeout(this.heatmapTimerId);
        }
    }

    private getCanvasMask(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): ImageData {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context for grief mask');
        }

        return ctx.getImageData(x, y, width, height);
    }

    private collectExistingGriefs(): void {
        if (!this.templateContext) {
            return;
        }
        const { template, detemplatizedImage, detemplatizedImageUint32View } = this.templateContext;
        const { width: templateWidth, height: templateHeight } = detemplatizedImage;

        const board = getPxlsUIBoard();
        const boardCtx = board.getContext('2d');

        if (!boardCtx) {
            throw new Error('Failed to get board canvas context');
        }

        const detectionMode = this.settings.detectionMode.get();

        const { x: templateX, y: templateY } = template;
        const boardImageData = boardCtx.getImageData(templateX, templateY, templateWidth, templateHeight);
        const boardImageDataUint32View = new Uint32Array(boardImageData.data.buffer);

        let canvasMask = null;
        if (detectionMode === 'nonVirginOnly') {
            canvasMask = this.getCanvasMask(
                getPxlsUIVirginmapBoard(),
                templateX,
                templateY,
                templateWidth,
                templateHeight,
            );
        } else if (detectionMode === 'recentOnly') {
            canvasMask = this.getCanvasMask(
                getPxlsUIHeatmapBoard(),
                templateX,
                templateY,
                templateWidth,
                templateHeight,
            );
            if (this.heatmapTimerId != null) {
                window.clearTimeout(this.heatmapTimerId);
            }
            this.heatmapTimerId = window.setTimeout(() => {
                this.collectExistingGriefs();
            }, 60_000);
        }

        const debugTimer = debugTime('collectExistingGriefs');
        const griefs: [number, number][] = [];
        for (let y = 0; y < templateHeight; y++) {
            const rowStart = y * templateWidth;
            for (let x = 0; x < templateWidth; x++) {
                const pixelIndex = rowStart + x;
                const pixelAlphaIndex = pixelIndex * 4 + 3;

                const templateAlpha = detemplatizedImage.data[pixelAlphaIndex];
                if (templateAlpha === 0) {
                    // ignore pixels that aren't in the template
                    continue;
                }

                if (canvasMask != null) {
                    const canvasMaskAlpha = canvasMask.data[pixelAlphaIndex];
                    if (canvasMaskAlpha === 0) {
                        // ignore pixels that are not on the canvas mask
                        continue;
                    }
                }

                const boardColor = boardImageDataUint32View[pixelIndex];
                const templateColor = detemplatizedImageUint32View[pixelIndex];

                if (boardColor !== templateColor) {
                    // placed color is different from template color, this is a grief
                    griefs.push([x, y]);
                }
            }
        }
        debugTimer?.stop();
        this.clearGriefList();
        this.updateGriefsCanvasSize(templateWidth, templateHeight);
        this.addGriefs(griefs);
    }

    private pixelPlaced(pixel: PlacedPixelData): void {
        if (!this.templateContext) {
            return;
        }
        const { template, detemplatizedImage, detemplatizedImageUint32View } = this.templateContext;

        const placedColor = this.palette.at(pixel.color);
        if (placedColor == null) {
            // somehow the color is not in the palette, this should never really happen
            console.error(`Color ${pixel.color} not found in palette`);
            return;
        }

        const pixelTemplateX = pixel.x - template.x;
        const pixelTemplateY = pixel.y - template.y;
        if (
            pixelTemplateX < 0 ||
            pixelTemplateY < 0 ||
            pixelTemplateX >= detemplatizedImage.width ||
            pixelTemplateY >= detemplatizedImage.height
        ) {
            // out of bounds
            return;
        }

        const pixelIndex = pixelTemplateY * detemplatizedImage.width + pixelTemplateX;
        const pixelAlpha = detemplatizedImage.data[pixelIndex * 4 + 3];

        if (pixelAlpha === 0) {
            // pixel is transparent
            return;
        }

        const pixelColor = detemplatizedImageUint32View[pixelIndex];

        if (pixelColor !== placedColor) {
            // placed color is different from template color, this is a grief
            this.addGrief(pixelTemplateX, pixelTemplateY);
        } else {
            this.removeGrief(pixelTemplateX, pixelTemplateY);
        }
    }

    private clearTemplate(): void {
        this.templateContext = null;
        if (this.animationFrameRequestId != null) {
            window.cancelAnimationFrame(this.animationFrameRequestId);
        }
        this.clearGriefList();
        this.infoIcon.setState('default');
    }

    private templateChanged(template: TemplateData): void {
        const width = template.width;
        this.infoIcon.setState('loadingTemplate');

        getTemplateImage()
            .then(async (imageData) => {
                debug('Template image loaded');
                return detemplatizeImage(imageData, width);
            })
            .then((detemplatizedImageData) => {
                debug('Template image detemplatized');
                this.templateContext = {
                    template,
                    detemplatizedImage: detemplatizedImageData,
                    detemplatizedImageUint32View: new Uint32Array(detemplatizedImageData.data.buffer),
                };
                this.clearGriefList();
                this.griefsCanvas.style.left = `${template.x}px`;
                this.griefsCanvas.style.top = `${template.y}px`;
                this.griefsCanvas.style.width = `${detemplatizedImageData.width}px`;
                this.griefsCanvas.style.height = `${detemplatizedImageData.height}px`;
                if (this.settings.detectionMode.get() !== 'newOnly') {
                    this.collectExistingGriefs();
                }
                if (this.settings.enabled.get()) {
                    this.infoIcon.setState('templateActive');
                } else {
                    this.infoIcon.setState('disabled');
                }
                window.requestAnimationFrame(this.handleAnimationFrame);
            })
            .catch((error: unknown) => {
                this.infoIcon.setState('error');
                if (error instanceof Error) {
                    this.messenger.showErrorMessage(`Failed to load template image: ${error.message}`, error);
                } else {
                    this.messenger.showErrorMessage(
                        'Failed to load template image: Unknown error',
                        new Error('Unknown error', { cause: error }),
                    );
                }
            });
    }

    private readonly handleAnimationFrame: FrameRequestCallback = (time): void => {
        this.animationFrameRequestId = window.requestAnimationFrame(this.handleAnimationFrame);
        if (!this.settings.enabled.get()) {
            return;
        }

        const animationSpeed = this.settings.animationSpeed.get();
        const animationInterval = GRIEF_ANIMATION_SPEED_MAP[animationSpeed];
        const colorIndex = Math.floor(time / animationInterval) % GRIEF_ANIMATION_COLORS.length;
        if (colorIndex === this.lastRenderedHighlightColorIndex) {
            return;
        }

        this.lastRenderedHighlightColorIndex = colorIndex;
        const highlightColor = GRIEF_ANIMATION_COLORS[colorIndex];

        const { width, height } = this.griefsCanvas;
        const { globalCompositeOperation, fillStyle } = this.griefsCtx;
        this.griefsCtx.globalCompositeOperation = 'source-atop';
        this.griefsCtx.fillStyle = highlightColor;
        this.griefsCtx.fillRect(0, 0, width, height);
        this.griefsCtx.globalCompositeOperation = globalCompositeOperation;
        this.griefsCtx.fillStyle = fillStyle;

        this.updateCachedGriefPixel();
    };

    private initBeforeApp(): void {
        bindWebSocketProxy();
        addStylesheet('dpus__grief-tracker', griefTrackerStyles);
    }

    private async initAfterApp(app: PxlsApp): Promise<void> {
        const { settings, griefsCanvas, infoIcon, clearGriefsIcon } = this;

        this.palette = await getFastLookupPalette();

        this.initSettings();

        infoIcon.addToIconsContainer();
        clearGriefsIcon.addToIconsContainer();
        clearGriefsIcon.toggleHidden(!settings.showClearGriefsButton.get());

        infoIcon.setState('loadingBoard');
        await waitForBoardLoaded();
        app.overlays.virginmap.reload();
        app.overlays.heatmap.reload();
        await Promise.all([waitForVirginmapLoaded(), waitForHeatmapLoaded()]);
        infoIcon.setState('default');

        this.initEventListeners();
        const boardContainer = getPxlsUIBoardContainer();
        boardContainer.appendChild(griefsCanvas);
        griefsCanvas.classList.toggle('dpus__grief-tracker--hidden', !settings.enabled.get());
        griefsCanvas.classList.toggle('dpus__grief-tracker--under-template', settings.renderUnderTemplate.get());

        const template = getCurrentTemplate();
        if (template) {
            debug('Template already set, loading');
            this.templateChanged(template);
        } else if (!settings.enabled.get()) {
            infoIcon.setState('disabled');
        }
    }
}
