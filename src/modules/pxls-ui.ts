let PXLS_UI_BOARD: HTMLCanvasElement | null = null;
let PXLS_UI_BOARD_CONTAINER: HTMLElement | null = null;
let PXLS_UI_VIRGINMAP_BOARD: HTMLCanvasElement | null = null;
let PXLS_UI_HEATMAP_BOARD: HTMLCanvasElement | null = null;
let PXLS_UI_TEMPLATE_IMAGE: HTMLImageElement | null = null;
let PXLS_UI_MOUSE_COORDS: HTMLElement | null = null;
let PXLS_UI_PALETTE_DESELECT_BUTTON: HTMLElement | null = null;
let PXLS_UI_PALETTE_SELECTION_BUTTONS: HTMLElement[] | null = null;
let PXLS_UI_TEMPLATE_URL_INPUT: HTMLInputElement | null = null;
let PXLS_UI_TEMPLATE_WIDTH_INPUT: HTMLInputElement | null = null;
let PXLS_UI_TEMPLATE_X_INPUT: HTMLInputElement | null = null;
let PXLS_UI_TEMPLATE_Y_INPUT: HTMLInputElement | null = null;
let PXLS_UI_TOP_UI: HTMLElement | null = null;
let PXLS_UI_MAIN_BUBBLE: HTMLElement | null = null;
let PXLS_UI_PLACEABLE_COUNT: HTMLElement | null = null;

function getPxlsUIElement<T extends Element | Element[]>(getter: () => T | null, name: string): T {
    const element = getter();
    if (!element) {
        throw new Error(`${name} is not initialized`);
    }
    return element;
}

export function getPxlsUIBoard(): HTMLCanvasElement {
    return getPxlsUIElement(() => PXLS_UI_BOARD, 'PXLS_UI_BOARD');
}

export function getPxlsUIBoardContainer(): HTMLElement {
    return getPxlsUIElement(() => PXLS_UI_BOARD_CONTAINER, 'PXLS_UI_BOARD_CONTAINER');
}

export function getPxlsUIVirginmapBoard(): HTMLCanvasElement {
    return getPxlsUIElement(() => PXLS_UI_VIRGINMAP_BOARD, 'PXLS_UI_VIRGINMAP_BOARD');
}

export function getPxlsUIHeatmapBoard(): HTMLCanvasElement {
    return getPxlsUIElement(() => PXLS_UI_HEATMAP_BOARD, 'PXLS_UI_HEATMAP_BOARD');
}

export function getPxlsUITemplateImage(): HTMLImageElement {
    return getPxlsUIElement(() => PXLS_UI_TEMPLATE_IMAGE, 'PXLS_UI_TEMPLATE_IMAGE');
}

export function getPxlsUIMouseCoords(): HTMLElement {
    return getPxlsUIElement(() => PXLS_UI_MOUSE_COORDS, 'PXLS_UI_MOUSE_COORDS');
}

export function getPxlsUIPaletteDeselectButton(): HTMLElement {
    return getPxlsUIElement(() => PXLS_UI_PALETTE_DESELECT_BUTTON, 'PXLS_UI_PALETTE_DESELECT_BUTTON');
}

export function getPxlsUIPaletteSelectionButtons(): HTMLElement[] {
    return getPxlsUIElement(() => PXLS_UI_PALETTE_SELECTION_BUTTONS, 'PXLS_UI_PALETTE_SELECTION_BUTTONS');
}

export function getPxlsUITemplateUrlInput(): HTMLInputElement {
    return getPxlsUIElement(() => PXLS_UI_TEMPLATE_URL_INPUT, 'PXLS_UI_TEMPLATE_URL_INPUT');
}

export function getPxlsUITemplateWidthInput(): HTMLInputElement {
    return getPxlsUIElement(() => PXLS_UI_TEMPLATE_WIDTH_INPUT, 'PXLS_UI_TEMPLATE_WIDTH_INPUT');
}

export function getPxlsUITemplateXInput(): HTMLInputElement {
    return getPxlsUIElement(() => PXLS_UI_TEMPLATE_X_INPUT, 'PXLS_UI_TEMPLATE_X_INPUT');
}

export function getPxlsUITemplateYInput(): HTMLInputElement {
    return getPxlsUIElement(() => PXLS_UI_TEMPLATE_Y_INPUT, 'PXLS_UI_TEMPLATE_Y_INPUT');
}

export function getPxlsUITopUI(): HTMLElement {
    return getPxlsUIElement(() => PXLS_UI_TOP_UI, 'PXLS_UI_TOP_UI');
}

export function getPxlsUIMainBubble(): HTMLElement {
    return getPxlsUIElement(() => PXLS_UI_MAIN_BUBBLE, 'PXLS_UI_MAIN_BUBBLE');
}

export function getPxlsUIPlaceableCount(): HTMLElement {
    return getPxlsUIElement(() => PXLS_UI_PLACEABLE_COUNT, 'PXLS_UI_PLACEABLE_COUNT');
}

export function findUIElements(): void {
    PXLS_UI_BOARD = document.querySelector('canvas#board');
    if (!PXLS_UI_BOARD) {
        throw new Error('Failed to find board canvas, this should never happen');
    }

    PXLS_UI_BOARD_CONTAINER = document.querySelector('#board-mover');
    if (!PXLS_UI_BOARD_CONTAINER) {
        throw new Error('Failed to find board container, this should never happen');
    }

    PXLS_UI_VIRGINMAP_BOARD = document.querySelector('canvas#virginmap');
    if (!PXLS_UI_VIRGINMAP_BOARD) {
        throw new Error('Failed to find virginmap canvas, this should never happen');
    }

    PXLS_UI_HEATMAP_BOARD = document.querySelector('canvas#heatmap');
    if (!PXLS_UI_HEATMAP_BOARD) {
        throw new Error('Failed to find heatmap canvas, this should never happen');
    }

    PXLS_UI_TEMPLATE_IMAGE = document.querySelector('img.board-template');
    if (!PXLS_UI_TEMPLATE_IMAGE) {
        throw new Error('Failed to find template image, this should never happen');
    }

    PXLS_UI_MOUSE_COORDS = document.querySelector('#coords-info > .coords');
    if (!PXLS_UI_MOUSE_COORDS) {
        throw new Error('Failed to find mouse coords, this should never happen');
    }

    PXLS_UI_PALETTE_DESELECT_BUTTON = document.querySelector('#palette > .palette-button.deselect-button');
    if (!PXLS_UI_PALETTE_DESELECT_BUTTON) {
        throw new Error('Failed to find palette deselect button, this should never happen');
    }

    const paletteButtons: NodeListOf<HTMLElement> = document.querySelectorAll(
        '#palette > .palette-button:not(.deselect-button):not(.palette-button-special)',
    );
    if (paletteButtons.length === 0) {
        throw new Error('Failed to find palette buttons, this should never happen');
    } else {
        PXLS_UI_PALETTE_SELECTION_BUTTONS = Array.from(paletteButtons);
    }

    PXLS_UI_TEMPLATE_URL_INPUT = document.querySelector('input#template-url');
    if (!PXLS_UI_TEMPLATE_URL_INPUT) {
        throw new Error('Failed to find template URL input, this should never happen');
    }

    PXLS_UI_TEMPLATE_WIDTH_INPUT = document.querySelector('input#template-width');
    if (!PXLS_UI_TEMPLATE_WIDTH_INPUT) {
        throw new Error('Failed to find template width input, this should never happen');
    }

    PXLS_UI_TEMPLATE_X_INPUT = document.querySelector('input#template-coords-x');
    if (!PXLS_UI_TEMPLATE_X_INPUT) {
        throw new Error('Failed to find template x input, this should never happen');
    }

    PXLS_UI_TEMPLATE_Y_INPUT = document.querySelector('input#template-coords-y');
    if (!PXLS_UI_TEMPLATE_Y_INPUT) {
        throw new Error('Failed to find template y input, this should never happen');
    }

    PXLS_UI_TOP_UI = document.querySelector('#ui > #ui-top');
    if (!PXLS_UI_TOP_UI) {
        throw new Error('Failed to find top UI, this should never happen');
    }

    PXLS_UI_MAIN_BUBBLE = document.querySelector('#ui > #ui-top > #main-bubble');
    if (!PXLS_UI_MAIN_BUBBLE) {
        throw new Error('Failed to find main bubble, this should never happen');
    }

    PXLS_UI_PLACEABLE_COUNT = document.querySelector('#placeable-count');
    if (!PXLS_UI_PLACEABLE_COUNT) {
        throw new Error('Failed to find placeable count, this should never happen');
    }
}

let BOARD_LOAD_PROMISE: Promise<HTMLCanvasElement> | null;

export async function waitForBoardLoaded(): Promise<HTMLCanvasElement> {
    if (BOARD_LOAD_PROMISE) {
        return BOARD_LOAD_PROMISE;
    }

    const board = getPxlsUIBoard();
    const ctx = board.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context for board canvas');
    }
    const { promise, resolve } = Promise.withResolvers<HTMLCanvasElement>();
    BOARD_LOAD_PROMISE = promise;
    const intervalId = setInterval(() => {
        const imageData = ctx.getImageData(0, 0, board.width, board.height);
        for (let i = 0; i < imageData.data.length; i += 4) {
            // find the first non-transparent pixel
            if (imageData.data[i + 3] !== 0) {
                clearInterval(intervalId);
                resolve(board);
                return;
            }
        }
    }, 1000);
    return promise;
}

async function waitForCanvasLoaded(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    const { promise, resolve } = Promise.withResolvers<HTMLCanvasElement>();
    const sizeAttributesCheck = (): void => {
        if (canvas.getAttribute('width') !== null && canvas.getAttribute('height') !== null) {
            observer.disconnect();
            resolve(canvas);
        }
    };
    const observer = new MutationObserver(() => {
        sizeAttributesCheck();
    });
    observer.observe(canvas, {
        attributes: true,
        attributeFilter: ['width', 'height'],
    });
    sizeAttributesCheck();
    return promise;
}

let VIRGINMAP_LOAD_PROMISE: Promise<HTMLCanvasElement> | null;

export async function waitForVirginmapLoaded(): Promise<HTMLCanvasElement> {
    VIRGINMAP_LOAD_PROMISE ??= waitForCanvasLoaded(getPxlsUIVirginmapBoard());
    return VIRGINMAP_LOAD_PROMISE;
}

let HEATMAP_LOAD_PROMISE: Promise<HTMLCanvasElement> | null;

export async function waitForHeatmapLoaded(): Promise<HTMLCanvasElement> {
    HEATMAP_LOAD_PROMISE ??= waitForCanvasLoaded(getPxlsUIHeatmapBoard());
    return HEATMAP_LOAD_PROMISE;
}
