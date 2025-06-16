import { addStylesheet } from '../../modules/document';
import type { PxlsAppTemplateConvertMode, PxlsBoardModule } from '../../pxls/pxls-modules';
import type { PxlsInfoResponse } from '../../pxls/pxls-types';
import { CanvasResizeWatcher, compileShader, createProgram } from '../../util/webgl';
import boardStyle from './board.css';
import fragmentShaderSource from './board.frag';
import vertexShaderSource from './board.vert';
import type { ModuleExport, ModuleImportFunction } from './types';
import { DEFAULT_BROKEN_SCRIPT } from './util';

declare const requireFn: ModuleImportFunction;
declare const moduleExport: ModuleExport<'board'>;

interface BufferedPixel {
    x: number;
    y: number;
    color: number;
}

const { settings } = requireFn('./settings');
const { panels } = requireFn('./panels');
const { socket } = requireFn('./socket');
const { lookup } = requireFn('./lookup');
const { overlays } = requireFn('./overlays');
const { user } = requireFn('./user');
const { place } = requireFn('./place');
const { template } = requireFn('./template');
const { uiHelper } = requireFn('./uiHelper');
const { chat } = requireFn('./chat');
const { query } = requireFn('./query');
const { ls } = requireFn('./storage');
const { grid } = requireFn('./grid');

let loaded = false;
let allowDrag = true;

const board = {
    _canvas: document.createElement('canvas'),
    _imageData: null as ImageData | null,
    _int32View: null as Int32Array | null,
    _imageUpdatedSinceLastRender: false,
    _panX: 0,
    _panY: 0,
    _scale: 1,
    _initializedSize: false,
    _width: 1,
    _height: 1,
    get canvas(): HTMLCanvasElement {
        return board._canvas;
    },
    get imageData(): ImageData | null {
        return board._imageData;
    },
    get int32View(): Int32Array | null {
        return board._int32View;
    },
    get panX(): number {
        return board._panX;
    },
    get panY(): number {
        return board._panY;
    },
    get scale(): number {
        return board._scale;
    },
    get width(): number {
        return board._width;
    },
    get height(): number {
        return board._height;
    },
    setPan({ x, y }: { x?: number | string; y?: number | string }): void {
        if (x != null) {
            if (typeof x === 'string') {
                x = parseFloat(x);
            }
            board._panX = Math.max(0, Math.min(x, board.width));
        }
        if (y != null) {
            if (typeof y === 'string') {
                y = parseFloat(y);
            }
            board._panY = Math.max(0, Math.min(y, board.height));
        }
    },
    setScale(newScale: number | string): void {
        const minScale = settings.board.zoom.limit.minimum.get();
        const maxScale = settings.board.zoom.limit.maximum.get();

        if (typeof newScale === 'string') {
            newScale = parseFloat(newScale);
        }

        if (isNaN(newScale)) {
            newScale = 1;
        }

        newScale = Math.max(minScale, Math.min(maxScale, newScale));

        if (settings.board.zoom.rounding.enable.get()) {
            let roundFn: (num: number) => number;
            if (newScale < board.scale) {
                roundFn = Math.floor;
            } else {
                roundFn = Math.ceil;
            }

            if (newScale > 1) {
                if (board.scale < 1) {
                    newScale = 1;
                } else {
                    newScale = roundFn(newScale);
                }
            } else {
                if (board.scale > 1) {
                    newScale = 1;
                } else {
                    newScale = 2 ** roundFn(Math.log(newScale) / Math.log(2));
                }
            }
        }

        board._scale = newScale;
    },
    nudgeScale(delta: number): void {
        const zoomBase = settings.board.zoom.sensitivity.get();
        board.setScale(board.scale * zoomBase ** delta);
    },
    setSize(width: number, height: number): void {
        if (board._initializedSize) {
            return;
        }
        board._width = width;
        board._height = height;
        board._imageData = new ImageData(width, height);
        board._int32View = new Int32Array(board._imageData.data.buffer);
        board._initializedSize = true;
    },
    setPixel(x: number, y: number, color: number, colorMode: 'index' | 'rgba'): void {
        if (board._int32View == null || x < 0 || x >= board.width || y < 0 || y >= board.height) {
            return;
        }
        x = Math.floor(x);
        y = Math.floor(y);
        board.setPixelIndex(y * board.width + x, color, colorMode);
    },
    setPixelIndex(pixelIndex: number, colorOrIndex: number, colorMode: 'index' | 'rgba'): void {
        if (board._int32View == null || pixelIndex < 0 || pixelIndex >= board.width * board.height) {
            return;
        }

        let color: number;
        switch (colorMode) {
            case 'index': {
                const maybeColor = paletteRgbNumbers.at(colorOrIndex);
                if (maybeColor == null) {
                    return;
                }
                color = maybeColor;
                break;
            }
            case 'rgba': {
                color = colorOrIndex;
            }
        }

        board._int32View[pixelIndex] = color;
        board._imageUpdatedSinceLastRender = true;
    },
    insertCanvasIntoDom(): void {
        const container = document.querySelector('#board-container');
        if (container == null) {
            throw new Error('Board container not found');
        }

        container.innerHTML = '';
        addStylesheet('dpus__mr-board', boardStyle);
        board.canvas.classList.add('board', 'noselect', 'dpus__mr-board');
        container.appendChild(board.canvas);
    },
};

const webGlRenderer = {
    _context: null as WebGL2RenderingContext | null,
    _program: null as WebGLProgram | null,
    _resizeWatcher: new CanvasResizeWatcher(board.canvas),
    init(): void {
        const canvas = board.canvas;
        const gl = canvas.getContext('webgl2', {
            antialias: false,
            alpha: true,
            depth: false,
            stencil: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: true,
        });
        if (gl == null) {
            throw new Error('Failed to create WebGL context');
        }
        const vertexShader = compileShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(gl, fragmentShaderSource, gl.FRAGMENT_SHADER);
        const program = createProgram(gl, vertexShader, fragmentShader);

        webGlRenderer._context = gl;
        webGlRenderer._program = program;
    },
};

const boardPanner = {
    _pointerDownCoordinates: new Map<number, { x: number; y: number }>(),
    pointerDown(e: PointerEvent): void {
        // todo: add pointer
        // todo: begin panning or whatever
    },
    pointerMove(e: PointerEvent): void {
        // todo: pan/zoom according to active pointers
    },
    pointerUp(e: PointerEvent): void {
        boardPanner._removePointerId(e.pointerId);
    },
    pointerCancel(e: PointerEvent): void {
        boardPanner._removePointerId(e.pointerId);
    },
    get _anyPointerActive(): boolean {
        return boardPanner._pointerDownCoordinates.size > 0;
    },
    _addPointerId(pointerId: number, x: number, y: number): void {
        boardPanner._pointerDownCoordinates.set(pointerId, { x, y });
    },
    _removePointerId(pointerId: number): void {
        boardPanner._pointerDownCoordinates.delete(pointerId);
    },
};

const paletteRgbNumbers: number[] = [];

const pixelReplay: BufferedPixel[] = [];

let webInfo: PxlsInfoResponse | false = false;

const save = async (): Promise<void> => {
    const canvas = new OffscreenCanvas(board.width, board.height);
    const ctx = canvas.getContext('2d');
    if (ctx == null) {
        throw new Error('Failed to create OffscreenCanvas context');
    }
    ctx.putImageData(board.imageData!, 0, 0);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    const now = new Date();
    const pad = (num: number): string => String(num).padStart(2, '0');
    a.download = `pxls canvas ${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}.${pad(now.getUTCMinutes())}.${pad(now.getUTCSeconds())}.png`;
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
};

const initInteraction = (): void => {
    document.body.addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
        }

        switch (e.key) {
            case 'w':
            case 'ArrowUp':
                board.setPan({ y: board.panY - 100 / board.scale });
                break;
            case 'd':
            case 'ArrowRight':
                board.setPan({ x: board.panX + 100 / board.scale });
                break;
            case 's':
            case 'ArrowDown':
                board.setPan({ y: board.panY + 100 / board.scale });
                break;
            case 'a':
            case 'ArrowLeft':
                board.setPan({ x: board.panX - 100 / board.scale });
                break;
            case 'p':
                boardExport.save();
                break;
            case 'l':
                settings.board.lock.enable.toggle();
                break;
            case 'r':
                {
                    const templateOptions = template.getOptions();
                    if (templateOptions.use === true) {
                        board.setPan({ x: templateOptions.x, y: templateOptions.y });
                    } else if (place.lastPixel) {
                        board.setPan({ x: place.lastPixel.x, y: place.lastPixel.y });
                    }
                }
                break;
            case 'j':
                if (place.color < 1) {
                    place.switch(place.palette.length - 1);
                } else {
                    place.switch(place.color - 1);
                }
                break;
            case 'k':
                if (place.color + 1 >= place.palette.length) {
                    place.switch(0);
                } else {
                    place.switch(place.color + 1);
                }
                break;
            case 'e':
            case '+':
                board.nudgeScale(1);
                break;
            case 'q':
            case '-':
                board.nudgeScale(-1);
                break;
            case 't':
                panels.toggle('settings');
                break;
            case 'i':
                panels.toggle('info');
                break;
            case 'b':
                if (settings.chat.enable.get()) {
                    panels.toggle('chat');
                }
        }
    });

    board.canvas.addEventListener(
        'wheel',
        (e) => {
            // todo: implement zooming
        },
        { passive: true },
    );

    board.canvas.addEventListener('pointerdown', (e) => {
        boardPanner.pointerDown(e);
    });

    board.canvas.addEventListener('pointermove', (e) => {
        boardPanner.pointerMove(e);
    });

    board.canvas.addEventListener('pointerup', (e) => {
        boardPanner.pointerUp(e);
        // todo: place pixel
    });

    board.canvas.addEventListener('pointercancel', (e) => {
        boardPanner.pointerCancel(e);
    });
};

const init = (): void => {
    $(window).on('pxls:queryUpdated', (evt, propName: string, oldValue: string | null, newValue: string | null) => {
        const nullish = newValue == null;
        switch (propName.toLowerCase()) {
            case 'x':
                if (!nullish) {
                    board.setPan({ x: newValue });
                }
                break;
            case 'y':
                if (!nullish) {
                    board.setPan({ y: newValue });
                }
                break;
            case 'scale':
                if (!nullish) {
                    board.setScale(newValue);
                }
                break;
            case 'template':
                template.queueUpdate({ url: newValue, use: !nullish });
                break;
            case 'ox':
                template.queueUpdate({ x: nullish ? null : parseInt(newValue) });
                break;
            case 'oy':
                template.queueUpdate({ y: nullish ? null : parseInt(newValue) });
                break;
            case 'tw':
                template.queueUpdate({ width: nullish ? null : parseInt(newValue) });
                break;
            case 'title':
                template.queueUpdate({ title: newValue ?? '' });
                break;
            case 'convert':
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- original code does this
                template.queueUpdate({ convertMode: newValue as PxlsAppTemplateConvertMode });
                break;
        }
    });

    // todo: initialize canvas
    initInteraction();
};

const drawBoard = async (): Promise<void> => {
    const boardDataResponse = await fetch('/boarddata');
    const boardData = await boardDataResponse.bytes();

    paletteRgbNumbers.push(...place.getPaletteABGR());

    for (let i = 0; i < boardData.length; i++) {
        board.setPixelIndex(i, boardData[i], 'index');
    }

    boardExport.update(false);
    loaded = true;
    for (const pixel of pixelReplay) {
        board.setPixel(pixel.x, pixel.y, pixel.color, 'index');
    }
    pixelReplay.length = 0;
};

const start = (): void => {
    fetch('/info')
        .then(async (response) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- original code does this
            const data = (await response.json()) as PxlsInfoResponse;
            webInfo = data;
            lookup.webinit();
            overlays.webinit(data);
            user.webinit(data);
            place.setPalette(data.palette);
            template.webinit(data);
            uiHelper.setMax(data.maxStacked);
            chat.webinit(data).catch((e) => console.error(e));
            uiHelper.initBanner(data.chatBannerText);
            if (data.captchaKey != null) {
                $('.g-recaptcha').attr('data-sitekey', data.captchaKey);
            }

            board.setSize(data.width, data.height);
            board.setPan({ x: query.get('x') ?? data.width / 2, y: query.get('y') ?? data.height / 2 });
            board.setScale(query.get('scale') ?? 1);

            socket.init();

            const templateUrl = query.get('template');
            if (templateUrl != null) {
                template.queueUpdate({
                    use: true,
                    x: parseFloat(query.get('x') ?? '0'),
                    y: parseFloat(query.get('y') ?? '0'),
                    width: parseFloat(query.get('tw') ?? '0'),
                    title: query.get('title') ?? '',
                    url: templateUrl,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- original code does this
                    convertMode: (query.get('convert') as PxlsAppTemplateConvertMode) ?? 'nearestCustom',
                });
            }

            const colorIndex = ls.get('color');
            if (colorIndex != null) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- original code does this
                place.switch(parseInt(colorIndex as string));
            }

            drawBoard().catch((e) => {
                console.error('Error drawing board:', e);
                socket.reconnect();
            });
        })
        .catch((e) => {
            console.error('Error fetching /info:', e);
            socket.reconnect();
        });
};

const update = (optional: boolean): boolean => {
    if (loaded) {
        query.set({
            x: board.panX.toString(),
            y: board.panY.toString(),
            scale: board.scale.toString(),
        });
    }

    if (optional) {
        return false;
    }

    // todo: set stuff to be pixelated if scale is above 1 (this is actually done in the fragment shader now so just remember to do it)

    place.update();
    grid.update();
    return true;
};

const boardExport: PxlsBoardModule = {
    init,
    start,
    update,
    getScale: (): number => {
        return board.scale;
    },
    nudgeScale: (adjustment): void => {
        board.nudgeScale(adjustment);
    },
    setScale: (scale, doUpdate = true): void => {
        board.setScale(scale);
        if (doUpdate) {
            boardExport.update(false);
        }
    },
    getPixelIndex: (x, y): number => {
        if (!boardExport.validateCoordinates(x, y) || !loaded) {
            return 0xff;
        }
        const int32View = board.int32View;
        if (!int32View) {
            return 0xff;
        }
        x = Math.floor(x);
        y = Math.floor(y);
        const color = int32View[y * board.width + x];
        const colorIndex = paletteRgbNumbers.indexOf(color);
        if (colorIndex === -1) {
            return 0xff;
        } else {
            return colorIndex;
        }
    },
    setPixelIndex: (x, y, color, refresh = true): void => {
        if (!loaded || board.int32View == null) {
            pixelReplay.push({ x, y, color });
            return;
        }

        let colorRgb: number | undefined;
        if (color === -1 || color === 0xff) {
            colorRgb = 0x00000000;
        } else {
            colorRgb = paletteRgbNumbers.at(color);
        }

        if (colorRgb == null) {
            return;
        }

        board.setPixel(x, y, colorRgb, 'rgba');
        if (refresh) {
            boardExport.update(false);
        }
    },
    fromScreen: (screenX, screenY, floored = true): { x: number; y: number } => {
        // todo: implement this
        return { x: 0, y: 0 };
    },
    toScreen: (boardX, boardY): { x: number; y: number } => {
        // todo: implement this
        return { x: 0, y: 0 };
    },
    save: () => {
        save();
    },
    centerOn: (x, y, ignoreLock = false): void => {
        if (x != null) {
            board.setPan({ x });
        }
        if (y != null) {
            board.setPan({ y });
        }
        boardExport.update(false, ignoreLock);
    },
    getRenderBoard: (): HTMLCanvasElement => {
        return board.canvas;
    },
    getContainer: (): HTMLElement => {
        // this only ever gets called in chromeOffsetWorkaround, but we replace that with a fake empty module so
        // this is no longer used
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- unused
        return null as unknown as HTMLElement;
    },
    getWidth: (): number => {
        return board.width;
    },
    getHeight: (): number => {
        return board.height;
    },
    refresh: (): void => {
        /* intentionally empty, WebGL renderer doesn't manually refresh the board image */
    },
    updateViewport: ({ scale, x, y }): void => {
        if (scale != null) {
            boardExport.setScale(scale, false);
        }
        boardExport.centerOn(x, y);
    },
    get allowDrag(): boolean {
        return allowDrag;
    },
    setAllowDrag: (allow): void => {
        allowDrag = allow === true;
    },
    validateCoordinates: (x, y): boolean => {
        return x >= 0 && x < board.width && y >= 0 && y < board.height;
    },
    get webInfo(): PxlsInfoResponse | false {
        return webInfo;
    },
    get snipMode(): boolean {
        if (webInfo !== false) {
            return webInfo.snipMode;
        } else {
            return false;
        }
    },
};
moduleExport.exports.board = boardExport;

export default DEFAULT_BROKEN_SCRIPT;
