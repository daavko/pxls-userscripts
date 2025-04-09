let PXLS_UI_BOARD: HTMLCanvasElement | null = null;
let PXLS_UI_TEMPLATE_IMAGE: HTMLImageElement | null = null;
let PXLS_UI_MOUSE_COORDS: HTMLElement | null = null;
let PXLS_UI_PALETTE_DESELECT_BUTTON: HTMLElement | null = null;
let PXLS_UI_PALETTE_SELECTION_BUTTONS: HTMLElement[] | null = null;
let PXLS_UI_TEMPLATE_WIDTH_INPUT: HTMLInputElement | null = null;
let PXLS_UI_TEMPLATE_X_INPUT: HTMLInputElement | null = null;
let PXLS_UI_TEMPLATE_Y_INPUT: HTMLInputElement | null = null;
let PXLS_UI_TOP_UI: HTMLElement | null = null;

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

export function findUIElements(): void {
    PXLS_UI_BOARD = document.querySelector('canvas#board');
    if (!PXLS_UI_BOARD) {
        throw new Error('Failed to find board canvas, this should never happen');
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
}
