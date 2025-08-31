import type {
    PxlsAppTemplateConvertMode,
    PxlsAppTemplateObject,
    PxlsAppTemplateUrlObject,
    PxlsBoardModule,
    PxlsQueryModule,
    PxlsTemplateModule,
    PxlsUiHelperModule,
} from '../../pxls/pxls-modules';
import type { PxlsExtendedBoardModule } from '../../pxls/pxls-modules-ext';
import type { PxlsInfoResponse } from '../../pxls/pxls-types';
import { eventTargetIsTextInput } from '../../util/event';
import type { Point } from '../../util/geometry';
import type { NullishKeys } from '../../util/types';
import {
    type PersistentQuadRenderableState,
    type PersistentSingleTextureState,
    QuadRenderable,
} from '../../util/webgl';
import type { ModuleExport, ModuleImportFunction } from './types';
import { DEFAULT_BROKEN_SCRIPT } from './util';

declare const requireFn: ModuleImportFunction;
declare const moduleExport: ModuleExport<'template'>;

const { settings } = requireFn('./settings');
let board: PxlsBoardModule | null = null;
let boardExt: PxlsExtendedBoardModule | null = null;
let query: PxlsQueryModule | null = null;
let uiHelper: PxlsUiHelperModule | null = null;

interface LoadedTemplate {
    url: string;
    image: ImageData;
    displayWidth: number;
    displayHeight: number;
    styleImage: ImageData | null;
}

interface QueuedOptionUpdate {
    options: NullishKeys<PxlsAppTemplateObject>;
    timer: number;
}

interface TemplateRenderableStyleModeNone {
    mode: 'none';
}

interface TemplateRenderableStyleModeDotted {
    mode: 'dotted';
    dotSize: number;
}

interface TemplateRenderableStyleModeTextured {
    mode: 'texture';
    textureData: Uint8Array;
    colorSize: number;
    textureInitialized: boolean;
}

type TemplateRenderableStyleMode =
    | TemplateRenderableStyleModeNone
    | TemplateRenderableStyleModeDotted
    | TemplateRenderableStyleModeTextured;

type TemplateRenderableStyleInputMode =
    | TemplateRenderableStyleModeNone
    | TemplateRenderableStyleModeDotted
    | Omit<TemplateRenderableStyleModeTextured, 'textureInitialized'>;

interface StyledTemplateRenderableState {
    template: PersistentSingleTextureState;
    palettizedTemplate: PersistentSingleTextureState;
    style: PersistentSingleTextureState;
}

class StyledTemplateRenderable extends QuadRenderable {
    protected readonly fragmentShaderSource: string;
    protected readonly vertexShaderSource: string;

    protected textureState: StyledTemplateRenderableState | null = null;

    private textureInitialized = false;
    // original RGBA texture data
    private textureBufferData: Uint32Array;
    private textureBufferWebGLView: Uint8Array;
    // RG texture data, red channel is palette index, green channel is alpha
    private palettizedTextureBufferData: Uint16Array;
    private palettizedTextureBufferWebGLView: Uint8Array;

    private styleMode: TemplateRenderableStyleMode = { mode: 'none' };

    constructor(rect: DOMRect) {
        super('dpus_template', 'Template', rect);
    }

    override init(ctx: WebGL2RenderingContext): void {
        if (this.textureState != null) {
            console.warn('StyledTemplateRenderable: Texture state already initialized');
            return;
        }

        super.init(ctx);

        this.textureState = {
            template: { texture: ctx.createTexture() },
            palettizedTemplate: { texture: ctx.createTexture() },
            style: { texture: ctx.createTexture() },
        };
    }

    replaceTemplateTexture(imageData: ImageData, paletteRgbNumbers: number[]): void {
        this.textureInitialized = false;
        this.textureBufferData = new Uint32Array(imageData.data.buffer);
        this.textureBufferWebGLView = new Uint8Array(imageData.data.buffer);
        this.palettizedTextureBufferData = new Uint16Array(imageData.width * imageData.height);
        this.palettizedTextureBufferWebGLView = new Uint8Array(this.palettizedTextureBufferData.buffer);

        for (let i = 0; i < this.textureBufferData.length; i++) {
            const rgba = this.textureBufferData[i];
            const alpha = (rgba >> 24) & 0xff;
            if (alpha === 0) {
                this.palettizedTextureBufferData[i] = 0;
                continue;
            }
            const paletteIndex = paletteRgbNumbers.indexOf(rgba);
            if (paletteIndex === -1) {
                // not found in palette, use transparent
                this.palettizedTextureBufferData[i] = 0;
            } else {
                this.palettizedTextureBufferData[i] = (paletteIndex & 0xff) | ((alpha & 0xff) << 8);
            }
        }
    }

    replaceTemplateSize(width: number, height: number): void {
        this.width = width;
        this.height = height;
    }

    setStyleMode(mode: TemplateRenderableStyleInputMode): void {
        if (this.styleMode.mode === mode.mode) {
            switch (this.styleMode.mode) {
                case 'dotted':
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                    this.styleMode.dotSize = (mode as TemplateRenderableStyleModeDotted).dotSize;
                    break;
                case 'texture': {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
                    const { textureData, colorSize } = mode as TemplateRenderableStyleModeTextured;
                    this.styleMode = { mode: 'texture', textureData, colorSize, textureInitialized: false };
                }
            }
        } else {
            if (mode.mode === 'texture') {
                this.styleMode = { ...mode, textureInitialized: false };
            } else {
                this.styleMode = mode;
            }
        }
    }

    getPixel(x: number, y: number): number | undefined {
        return this.textureBufferData.at(this.getIndexUnchecked(x, y));
    }

    getPixelByIndex(index: number): number | undefined {
        return this.textureBufferData.at(index);
    }

    protected getIndexUnchecked(x: number, y: number): number {
        return y * this.rect.width + x;
    }

    protected bindTextureData(ctx: WebGL2RenderingContext, state: PersistentQuadRenderableState): void {}

    protected fillTextureData(ctx: WebGL2RenderingContext): void {}
}

const builtinStyles = new Map<string, string>();
const styleOptionValues = ['1to1nearestCustom', '1to1unconverted', 'smallDots', 'bigDots', 'symbols', 'numbers'];

const template = {
    cors: null as { base: string; param: string } | null,
    elements: {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        useCheckbox: document.querySelector<HTMLInputElement>('input#template-use')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        titleInput: document.querySelector<HTMLInputElement>('input#template-title')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        urlInput: document.querySelector<HTMLInputElement>('input#template-url')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        imageErrorWarning: document.querySelector('#template-image-error-warning')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        xInput: document.querySelector<HTMLInputElement>('input#template-coords-x')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        yInput: document.querySelector<HTMLInputElement>('input#template-coords-y')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        widthInput: document.querySelector<HTMLInputElement>('input#template-width')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        widthResetBtn: document.querySelector<HTMLButtonElement>('button#template-width-reset')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        styleSelect: document.querySelector<HTMLSelectElement>('select#template-style-mode')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        conversionModeSelect: document.querySelector<HTMLSelectElement>('select#template-conversion-mode')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        opacityInput: document.querySelector<HTMLInputElement>('input#template-opacity')!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- assumed to exist
        opacityPercentage: document.querySelector<HTMLElement>('#template-opacity-percentage')!,
    },
    queuedOptionUpdate: null as QueuedOptionUpdate | null,
    options: {
        enabled: false,
        url: '',
        x: 0,
        y: 0,
        width: -1,
        title: '',
        convertMode: 'unconverted' as PxlsAppTemplateConvertMode,
        style: '',
    },
    loadedImage: null as LoadedTemplate | null,
    init: (): void => {
        const boardModule = requireFn('./board');
        board = boardModule.board;
        boardExt = boardModule.boardExt;
        query = requireFn('./query').query;
        uiHelper = requireFn('./uiHelper').uiHelper;

        const { elements } = template;

        $(elements.imageErrorWarning).hide();

        // ugly hack to set option values to known constants instead of arbitrary data URLs that can't be handled easily
        Array.from(elements.styleSelect.options).forEach((option, index) => {
            if (index === 0) {
                return;
            }
            if (index === 7) {
                // custom option
                option.value = 'custom';
            }
            const styleKey = styleOptionValues[index - 1];
            builtinStyles.set(styleKey, option.value);
            option.value = styleKey;
        });

        // todo: register to board renderer

        elements.useCheckbox.addEventListener('change', () => {
            template._update({ use: elements.useCheckbox.checked });
        });
        elements.titleInput.addEventListener(
            'change',
            () => {
                template._update({ title: elements.titleInput.value });
            },
            false,
        );
        elements.urlInput.addEventListener('change', () => {
            template._update({ use: true, url: elements.urlInput.value });
        });

        const xInputHandler = (): void => {
            template._update({ x: parseInt(elements.xInput.value, 10) }, false);
        };
        elements.xInput.addEventListener('change', xInputHandler);
        elements.xInput.addEventListener('input', xInputHandler);
        const yInputHandler = (): void => {
            template._update({ y: parseInt(elements.yInput.value, 10) }, false);
        };
        elements.yInput.addEventListener('change', yInputHandler);
        elements.yInput.addEventListener('input', yInputHandler);
        const widthInputHandler = (): void => {
            template._update({ width: parseInt(elements.widthInput.value, 10) }, false);
        };
        elements.widthInput.addEventListener('change', widthInputHandler);
        elements.widthInput.addEventListener('input', widthInputHandler);
        elements.widthResetBtn.addEventListener('click', () => {
            template._update({ width: -1 });
        });

        settings.board.template.opacity.listen((value) => {
            elements.opacityPercentage.textContent = `${Math.floor(value * 100)}%`;
        });

        settings.board.template.style.source.listen((value) => {
            template._update({ style: value }, false);
        });

        // todo: listen to custom style input changes

        const conversionModeHandler = (): void => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
            template._update({ convertMode: elements.conversionModeSelect.value as PxlsAppTemplateConvertMode });
        };
        elements.conversionModeSelect.addEventListener('change', conversionModeHandler);
        elements.conversionModeSelect.addEventListener('input', conversionModeHandler);

        template.updateSettings();

        document.body.addEventListener('keydown', (e) => {
            if (eventTargetIsTextInput(e) || e.repeat || e.ctrlKey || e.metaKey || e.altKey) {
                return;
            }

            if (e.key === 'v') {
                // todo: toggle template
            } else if (e.key === 'PageUp') {
                const opacity = settings.board.template.opacity.get();
                settings.board.template.opacity.set(Math.min(1, opacity + 0.1));
            } else if (e.key === 'PageDown') {
                const opacity = settings.board.template.opacity.get();
                settings.board.template.opacity.set(Math.max(0, opacity - 0.1));
            }
        });

        templateDragger.bindEvents(boardExt.boardCanvas);
    },
    webinit: (data: PxlsInfoResponse): void => {
        template.cors = {
            base: data.corsBase,
            param: data.corsParam,
        };
    },
    updateSettings(): void {
        const { elements, options, loadedImage } = template;
        elements.useCheckbox.checked = options.enabled;
        elements.urlInput.value = options.url;

        elements.titleInput.disabled = !options.enabled;
        elements.titleInput.value = options.title;

        if (options.enabled) {
            settings.board.template.opacity.controls.disable();
        } else {
            settings.board.template.opacity.controls.enable();
        }

        elements.xInput.disabled = !options.enabled;
        elements.xInput.value = options.x.toString();
        elements.yInput.disabled = !options.enabled;
        elements.yInput.value = options.y.toString();

        elements.widthInput.disabled = !options.enabled;
        if (options.width >= 0) {
            elements.widthInput.value = options.width.toString();
        } else if (loadedImage) {
            elements.widthInput.value = loadedImage.image.width.toString();
        } else {
            elements.widthInput.value = '';
        }

        elements.conversionModeSelect.value = options.convertMode;
    },
    _loadTemplate: (url: string): void => {
        // todo
    },
    _loadTemplateImage: async (url: URL): Promise<ImageData> => {
        template.elements.imageErrorWarning.textContent = '';
        $(template.elements.imageErrorWarning).hide();

        if (url.protocol === 'data:') {
            const response = await fetch(url);
            return template._responseToImageData(response);
        } else {
            let response: Response | null = null;
            try {
                response = await fetch(url);
            } catch (e: unknown) {
                console.warn('Failed to load template image with CORS, trying no-CORS', e);
            }

            if (response?.ok === true) {
                return await template._responseToImageData(response);
            }

            try {
                await fetch(url, { mode: 'no-cors' });
            } catch (e: unknown) {
                throw new Error('Failed to load template image (no-CORS fetch failed)', { cause: e });
            }

            if (!template.cors) {
                throw new Error('CORS proxy information not available');
            }
            const proxyUrl = new URL(template.cors.base);
            if (template.cors.param === '') {
                if (!proxyUrl.pathname.endsWith('/')) {
                    proxyUrl.pathname += '/';
                }
                proxyUrl.pathname += url.toString();
            } else {
                proxyUrl.searchParams.set(template.cors.param, url.toString());
            }

            const proxyResponse = await fetch(proxyUrl);
            return await template._responseToImageData(proxyResponse);
        }
    },
    _responseToImageData: async (response: Response): Promise<ImageData> => {
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        const blob = await response.blob();
        const img = await createImageBitmap(blob);
        const offscreen = new OffscreenCanvas(img.width, img.height);
        const ctx = offscreen.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, img.width, img.height);
    },
    _queueUpdate: (options: NullishKeys<PxlsAppTemplateObject>): void => {
        if (template.queuedOptionUpdate) {
            clearTimeout(template.queuedOptionUpdate.timer);
            template.queuedOptionUpdate.options = { ...template.queuedOptionUpdate.options, ...options };
        } else {
            template.queuedOptionUpdate = {
                options: { ...options },
                timer: 0,
            };
        }
        template.queuedOptionUpdate.timer = window.setTimeout(() => {
            if (template.queuedOptionUpdate) {
                template._update(template.queuedOptionUpdate.options);
                template.queuedOptionUpdate = null;
            }
        }, 200);
    },
    _update: (options: NullishKeys<PxlsAppTemplateObject>, updateSettings = true): void => {
        if (Object.keys(options).length === 0) {
            return;
        }

        let urlChanged = false;
        if (options.url != null && options.url.trim() !== '' && options.url !== template.options.url) {
            urlChanged = true;
            template.options.url = options.url.trim();
        }

        if (options.title != null && options.title.trim() !== '' && options.title !== template.options.title) {
            template.options.title = options.title.trim();
        }

        if (options.x != null && !Number.isNaN(options.x) && options.x !== template.options.x) {
            template.options.x = options.x;
        }

        if (options.y != null && !Number.isNaN(options.y) && options.y !== template.options.y) {
            template.options.y = options.y;
        }

        if (options.width != null && !Number.isNaN(options.width) && options.width !== template.options.width) {
            template.options.width = options.width;
        }

        if (options.convertMode != null && options.convertMode !== template.options.convertMode) {
            template.options.convertMode = options.convertMode;
        }

        if (options.style != null && options.style !== template.options.style) {
            template.options.style = options.style;
        }

        if (options.url?.length === 0 || options.use === false) {
            template.options.enabled = false;
            board?.update(true);
            query?.remove('template', true);
            query?.remove('title', true);
            query?.remove('ox', true);
            query?.remove('oy', true);
            query?.remove('tw', true);
            query?.remove('convert', true);
        } else {
            template.options.enabled = true;
        }

        query?.set('template', template.options.url, true);
        query?.set('title', template.options.title, true);
        query?.set('ox', template.options.x.toString(), true);
        query?.set('oy', template.options.y.toString(), true);
        query?.set('tw', template.options.width.toString(), true);
        query?.set('convert', template.options.convertMode, true);

        if (updateSettings) {
            template.updateSettings();
        }

        if (urlChanged) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- safe
            template.options.url = options.url!.trim();
            template._loadTemplate(template.options.url);
        }

        if (uiHelper) {
            document.title = uiHelper.getTitle();
        }

        if (template.loadedImage) {
            template.loadedImage.displayWidth =
                template.options.width > 0 ? template.options.width : template.loadedImage.image.width;
            template.loadedImage.displayHeight =
                (template.loadedImage.displayWidth / template.loadedImage.image.width) *
                template.loadedImage.image.height;
        }
    },
    _pointIsInTemplate: (point: Point): boolean => {
        const { options, loadedImage } = template;
        if (!options.enabled || !loadedImage) {
            return false;
        }

        const templateWidth = loadedImage.displayWidth;
        const templateHeight = loadedImage.displayHeight;

        return (
            point.x >= options.x &&
            point.x < options.x + templateWidth &&
            point.y >= options.y &&
            point.y < options.y + templateHeight
        );
    },
};

interface DragState {
    pointerId: number;
    // board-space coordinates
    pointerDown: Point;
    templatePosStart: Point;
}

const templateDragger = {
    _state: null as DragState | null,
    bindEvents: (canvas: HTMLCanvasElement): void => {
        canvas.addEventListener('pointerdown', (e) => {
            if (templateDragger._state) {
                return;
            }

            if (e.ctrlKey && e.isPrimary) {
                e.preventDefault();
                templateDragger._startDragging(e, canvas);
            }
        });

        canvas.addEventListener('pointermove', (e) => {
            templateDragger._dragMove(e);
        });

        canvas.addEventListener('pointerup', (e) => {
            templateDragger._stopDragging(e, canvas);
        });

        canvas.addEventListener('pointercancel', (e) => {
            templateDragger._stopDragging(e, canvas);
        });
    },
    _startDragging: (e: PointerEvent, canvas: HTMLCanvasElement): void => {
        if (!board) {
            return;
        }

        const boardPos = board.fromScreen(e.offsetX, e.offsetY);

        if (!template._pointIsInTemplate(boardPos)) {
            return;
        }

        templateDragger._state = {
            pointerId: e.pointerId,
            pointerDown: boardPos,
            templatePosStart: { x: template.options.x, y: template.options.y },
        };

        canvas.setPointerCapture(e.pointerId);
    },
    _dragMove: (e: PointerEvent): void => {
        if (!templateDragger._state || templateDragger._state.pointerId !== e.pointerId || !board) {
            return;
        }

        const boardPos = board.fromScreen(e.offsetX, e.offsetY);
        const dx = boardPos.x - templateDragger._state.pointerDown.x;
        const dy = boardPos.y - templateDragger._state.pointerDown.y;

        const newX = templateDragger._state.templatePosStart.x + dx;
        const newY = templateDragger._state.templatePosStart.y + dy;

        if (newX === template.options.x && newY === template.options.y) {
            return;
        }

        template._update({ x: newX, y: newY });
        query?.set('ox', newX.toString(), true);
        query?.set('oy', newY.toString(), true);
    },
    _stopDragging: (e: PointerEvent, canvas: HTMLCanvasElement): void => {
        if (templateDragger._state?.pointerId === e.pointerId) {
            canvas.releasePointerCapture(e.pointerId);
            templateDragger._state = null;
        }
    },
};

function normalizeTemplateObj(obj: PxlsAppTemplateUrlObject, dir: true): PxlsAppTemplateObject;
function normalizeTemplateObj(obj: PxlsAppTemplateObject, dir?: false): PxlsAppTemplateUrlObject;
function normalizeTemplateObj(
    obj: PxlsAppTemplateObject | PxlsAppTemplateUrlObject,
    dir?: boolean,
): PxlsAppTemplateObject | PxlsAppTemplateUrlObject {
    if (dir === true) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion, @typescript-eslint/no-shadow -- safe
        const { template, ox, oy, tw, title, convert } = obj as PxlsAppTemplateUrlObject;
        return {
            url: template,
            x: ox,
            y: oy,
            width: tw,
            title: title,
            convertMode: convert,
        } satisfies PxlsAppTemplateObject;
    } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        const { url, x, y, width, title, convertMode } = obj as PxlsAppTemplateObject;
        return {
            template: url,
            ox: x,
            oy: y,
            tw: width,
            title: title,
            convert: convertMode,
        } satisfies PxlsAppTemplateUrlObject;
    }
}

const templateExport: PxlsTemplateModule = {
    normalizeTemplateObj,
    update: (options: Partial<PxlsAppTemplateObject>, updateSettings?: boolean) => {
        template._update(options, updateSettings);
    },
    draw: () => {
        /* intentionally empty, WebGL renderer doesn't manually draw the template */
    },
    init: () => {
        template.init();
    },
    webinit: (data: PxlsInfoResponse) => {
        template.webinit(data);
    },
    queueUpdate: (templateObj: NullishKeys<PxlsAppTemplateObject>) => {
        template._queueUpdate(templateObj);
    },
    getOptions: () => {
        return {
            use: template.options.enabled,
            url: template.options.url,
            x: template.options.x,
            y: template.options.y,
            width: template.options.width,
            title: template.options.title,
            convertMode: template.options.convertMode,
            style: template.options.style,
        } satisfies PxlsAppTemplateObject;
    },
    setPixelated: () => {
        /* intentionally empty, WebGL renderer doesn't manually set pixelation */
    },
    getDisplayWidth: () => 0,
    getDisplayHeight: () => 0,
    getWidthRatio: () => 0,
};

moduleExport.exports.template = templateExport;

export default DEFAULT_BROKEN_SCRIPT;
