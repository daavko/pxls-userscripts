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
import { BooleanSetting, NumberSetting, SettingBase, Settings, type SettingUpdateCallback } from '../modules/settings';
import {
    createBooleanSetting,
    createNumberSetting,
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

const griefAnimationStyleSchema = v.picklist(['rgbwFlashThick', 'rgbwFlashThin']);
type GriefAnimationStyle = InferOutput<typeof griefAnimationStyleSchema>;

const griefAnimationSpeedSchema = v.picklist(['verySlow', 'slow', 'fast']);
type GriefAnimationSpeed = InferOutput<typeof griefAnimationSpeedSchema>;

const GRIEF_ANIMATION_STYLE_CLASS_MAP: Record<GriefAnimationStyle, string> = {
    rgbwFlashThick: 'dpus__grief-tracker--style-rgbw-flash-thick',
    rgbwFlashThin: 'dpus__grief-tracker--style-rgbw-flash-thin',
};

const GRIEF_ANIMATION_SPEED_CLASS_MAP: Record<GriefAnimationSpeed, string> = {
    fast: 'dpus__grief-tracker--speed-fast',
    slow: 'dpus__grief-tracker--speed-slow',
    verySlow: 'dpus__grief-tracker--speed-very-slow',
};

const GRIEF_ANIMATION_NAMES = ['dpus__grief-tracker-grief__rgbw-flash'];

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

export class GriefTrackerScript extends PxlsUserscript {
    private readonly messenger = new Messenger('Grief tracker');

    private readonly settings = Settings.create('griefTracker', {
        enabled: new BooleanSetting(true, [
            (_, newValue): void => {
                this.griefListContainer.classList.toggle('dpus__grief-tracker--hidden', !newValue);
                if (newValue) {
                    if (this.detemplatizedTemplate) {
                        this.infoIcon.setState('templateActive');
                    } else {
                        this.infoIcon.setState('default');
                    }
                } else {
                    this.infoIcon.setState('disabled');
                }
            },
        ]),
        maxGriefListSize: new NumberSetting(10_000, [
            (_, newValue): void => {
                if (newValue < 1) {
                    this.messenger.showErrorMessage('Max grief list size must be at least 1');
                    this.settings.maxGriefListSize.set(1);
                } else if (newValue < this.griefList.size) {
                    this.messenger.showErrorMessage(
                        `Max grief list size is now ${newValue}, but there are already ${this.griefList.size} griefs in the list. Clearing the list.`,
                    );
                    this.clearGriefList();
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
            (oldValue, newValue): void => {
                const oldClass = GRIEF_ANIMATION_STYLE_CLASS_MAP[oldValue];
                const newClass = GRIEF_ANIMATION_STYLE_CLASS_MAP[newValue];
                if (oldClass !== newClass) {
                    this.griefListContainer.classList.remove(oldClass);
                    this.griefListContainer.classList.add(newClass);
                }
            },
        ]),
        animationSpeed: new GriefAnimationSpeedSetting('slow', [
            (oldValue, newValue): void => {
                const oldClass = GRIEF_ANIMATION_SPEED_CLASS_MAP[oldValue];
                const newClass = GRIEF_ANIMATION_SPEED_CLASS_MAP[newValue];
                if (oldClass !== newClass) {
                    this.griefListContainer.classList.remove(oldClass);
                    this.griefListContainer.classList.add(newClass);
                }
            },
        ]),
        showClearGriefsButton: new BooleanSetting(true, [
            (_, newValue): void => {
                this.clearGriefsIcon.toggleHidden(!newValue);
            },
        ]),
    });

    private palette: number[] = [];

    private heatmapTimerId: number | null = null;

    private detemplatizedTemplate: ImageData | null = null;
    private detemplatizedTemplateUint32View: Uint32Array | null = null;

    private readonly griefListContainer = el('div', { class: 'dpus__grief-tracker' });
    private readonly griefList = new Map<string, Element>();

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

    private initSettings(): void {
        const { settings } = this;
        createSettingsUI('griefTracker', 'DPUS Grief Tracker', () => [
            createBooleanSetting(settings.enabled, 'Highlight griefs'),
            createNumberSetting(settings.maxGriefListSize, 'Max grief list size', { min: 1 }),
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
                { value: 'rgbwFlashThick', label: 'RGBW flash (thick)', title: 'Visible up to zoom 2' },
                { value: 'rgbwFlashThin', label: 'RGBW flash (thin)', title: 'Visible up to zoom 1' },
            ]),
            createSelectSetting(settings.animationSpeed, 'Animation speed', [
                { value: 'verySlow', label: 'Very slow', title: '2 seconds per animation frame' },
                { value: 'slow', label: 'Slow', title: '1 second per animation frame' },
                { value: 'fast', label: 'Fast', title: '500 milliseconds per animation frame' },
            ]),
            createBooleanSetting(settings.showClearGriefsButton, 'Show "Clear griefs" icon button'),
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
            if (!this.detemplatizedTemplate) {
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
                if (this.detemplatizedTemplate) {
                    this.clearTemplate();
                }
            }
        });
    }

    private coordToMapKey(x: number, y: number): string {
        return `${x},${y}`;
    }

    private createGriefHighlightElement(x: number, y: number): HTMLElement {
        return el('div', {
            class: 'dpus__grief-tracker-grief',
            styleCustomProperties: { '--dpus--grief-coord-x': `${x}`, '--dpus--grief-coord-y': `${y}` },
        });
    }

    private addGriefs(griefs: [number, number][]): void {
        const availableGriefListSize = this.settings.maxGriefListSize.get() - this.griefList.size;

        if (availableGriefListSize < griefs.length) {
            this.showTooManyGriefsMessage();
        }

        const griefsToAdd = Math.min(griefs.length, availableGriefListSize);
        for (const [x, y] of griefs.values().take(griefsToAdd)) {
            this.addGriefUnchecked(x, y);
        }
    }

    private addGrief(x: number, y: number): void {
        if (this.settings.maxGriefListSize.get() <= this.griefList.size) {
            this.showTooManyGriefsMessage();
            return;
        }

        this.addGriefUnchecked(x, y);
    }

    private addGriefUnchecked(x: number, y: number): void {
        debug('New grief at', x, y);

        const key = this.coordToMapKey(x, y);
        if (this.griefList.has(key)) {
            return;
        }

        const element = this.createGriefHighlightElement(x, y);
        this.griefListContainer.appendChild(element);
        element.addEventListener('animationstart', (e) => {
            if (GRIEF_ANIMATION_NAMES.includes(e.animationName)) {
                const animation = element
                    .getAnimations()
                    .find((a) => a instanceof CSSAnimation && a.animationName === e.animationName);
                if (animation) {
                    animation.startTime = 0;
                }
            }
        });
        this.griefList.set(key, element);
    }

    private removeGrief(x: number, y: number): void {
        const key = this.coordToMapKey(x, y);
        const element = this.griefList.get(key);
        if (element) {
            debug('Removing grief at', x, y);

            this.griefListContainer.removeChild(element);
            this.griefList.delete(key);
        }
    }

    private clearGriefList(): void {
        this.griefList.clear();
        this.griefListContainer.textContent = '';
        if (this.heatmapTimerId != null) {
            window.clearTimeout(this.heatmapTimerId);
        }
    }

    private showTooManyGriefsMessage(): void {
        this.messenger.showErrorMessage(
            `Too many griefs detected. Showing only the first ${this.settings.maxGriefListSize.get()}.`,
        );
    }

    private getCanvasMask(canvas: HTMLCanvasElement, x: number, y: number, width: number, height: number): ImageData {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get canvas context for grief mask');
        }

        return ctx.getImageData(x, y, width, height);
    }

    private collectExistingGriefs(): void {
        const template = getCurrentTemplate();
        if (!template || !this.detemplatizedTemplate || !this.detemplatizedTemplateUint32View) {
            return;
        }

        const board = getPxlsUIBoard();
        const boardCtx = board.getContext('2d');

        if (!boardCtx) {
            throw new Error('Failed to get board canvas context');
        }

        const detectionMode = this.settings.detectionMode.get();

        const { x: templateX, y: templateY } = template;
        const boardImageData = boardCtx.getImageData(
            templateX,
            templateY,
            this.detemplatizedTemplate.width,
            this.detemplatizedTemplate.height,
        );
        const boardImageDataUint32View = new Uint32Array(boardImageData.data.buffer);

        let canvasMask = null;
        if (detectionMode === 'nonVirginOnly') {
            canvasMask = this.getCanvasMask(
                getPxlsUIVirginmapBoard(),
                templateX,
                templateY,
                this.detemplatizedTemplate.width,
                this.detemplatizedTemplate.height,
            );
        } else if (detectionMode === 'recentOnly') {
            canvasMask = this.getCanvasMask(
                getPxlsUIHeatmapBoard(),
                templateX,
                templateY,
                this.detemplatizedTemplate.width,
                this.detemplatizedTemplate.height,
            );
            if (this.heatmapTimerId != null) {
                window.clearTimeout(this.heatmapTimerId);
            }
            this.heatmapTimerId = window.setTimeout(() => {
                this.clearGriefList();
                this.collectExistingGriefs();
            }, 60_000);
        }

        const debugTimer = debugTime('collectExistingGriefs');
        const griefs: [number, number][] = [];
        for (let y = 0; y < this.detemplatizedTemplate.height; y++) {
            const rowStart = y * this.detemplatizedTemplate.width;
            for (let x = 0; x < this.detemplatizedTemplate.width; x++) {
                const pixelIndex = rowStart + x;
                const pixelAlphaIndex = pixelIndex * 4 + 3;

                const templateAlpha = this.detemplatizedTemplate.data[pixelAlphaIndex];
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
                const templateColor = this.detemplatizedTemplateUint32View[pixelIndex];

                if (boardColor !== templateColor) {
                    // placed color is different from template color, this is a grief
                    griefs.push([x + templateX, y + templateY]);
                }
            }
        }
        debugTimer?.stop();
        this.addGriefs(griefs);
    }

    private pixelPlaced(pixel: PlacedPixelData): void {
        const template = getCurrentTemplate();
        if (!template || !this.detemplatizedTemplate || !this.detemplatizedTemplateUint32View) {
            return;
        }

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
            pixelTemplateX >= this.detemplatizedTemplate.width ||
            pixelTemplateY >= this.detemplatizedTemplate.height
        ) {
            // out of bounds
            return;
        }

        const pixelIndex = pixelTemplateY * this.detemplatizedTemplate.width + pixelTemplateX;
        const pixelAlpha = this.detemplatizedTemplate.data[pixelIndex * 4 + 3];

        if (pixelAlpha === 0) {
            // pixel is transparent
            return;
        }

        const pixelColor = this.detemplatizedTemplateUint32View[pixelIndex];

        if (pixelColor !== placedColor) {
            // placed color is different from template color, this is a grief
            this.addGrief(pixel.x, pixel.y);
        } else {
            this.removeGrief(pixel.x, pixel.y);
        }
    }

    private clearTemplate(): void {
        this.detemplatizedTemplate = null;
        this.detemplatizedTemplateUint32View = null;
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
                this.detemplatizedTemplate = detemplatizedImageData;
                this.detemplatizedTemplateUint32View = new Uint32Array(detemplatizedImageData.data.buffer);
                this.clearGriefList();
                if (this.settings.detectionMode.get() !== 'newOnly') {
                    this.collectExistingGriefs();
                }
                if (this.settings.enabled.get()) {
                    this.infoIcon.setState('templateActive');
                } else {
                    this.infoIcon.setState('disabled');
                }
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

    private initBeforeApp(): void {
        bindWebSocketProxy();
        addStylesheet('dpus__grief-tracker', griefTrackerStyles);
    }

    private async initAfterApp(app: PxlsApp): Promise<void> {
        const { settings, griefListContainer, infoIcon, clearGriefsIcon } = this;

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
        boardContainer.appendChild(griefListContainer);
        const griefListContainerSpeedClass = GRIEF_ANIMATION_SPEED_CLASS_MAP[settings.animationSpeed.get()];
        griefListContainer.classList.add(griefListContainerSpeedClass);
        const griefListContainerStyleClass = GRIEF_ANIMATION_STYLE_CLASS_MAP[settings.animationStyle.get()];
        griefListContainer.classList.add(griefListContainerStyleClass);
        griefListContainer.classList.toggle('dpus__grief-tracker--hidden', !settings.enabled.get());

        const template = getCurrentTemplate();
        if (template) {
            debug('Template already set, loading');
            this.templateChanged(template);
        } else if (!settings.enabled.get()) {
            infoIcon.setState('disabled');
        }
    }
}
