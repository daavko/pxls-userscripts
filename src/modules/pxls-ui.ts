export function getPxlsUIBoard(): HTMLCanvasElement {
    const element = document.querySelector<HTMLCanvasElement>('canvas#board');
    if (!element) {
        throw new Error('Failed to find board canvas, this should never happen');
    }
    return element;
}

export function getPxlsUIBoardContainer(): HTMLElement {
    const element = document.querySelector<HTMLElement>('#board-mover');
    if (!element) {
        throw new Error('Failed to find board container, this should never happen');
    }
    return element;
}

export function getPxlsUIVirginmapBoard(): HTMLCanvasElement {
    const element = document.querySelector<HTMLCanvasElement>('canvas#virginmap');
    if (!element) {
        throw new Error('Failed to find virginmap canvas, this should never happen');
    }
    return element;
}

export function getPxlsUIHeatmapBoard(): HTMLCanvasElement {
    const element = document.querySelector<HTMLCanvasElement>('canvas#heatmap');
    if (!element) {
        throw new Error('Failed to find heatmap canvas, this should never happen');
    }
    return element;
}

export function getPxlsUITemplateImage(): HTMLImageElement {
    const element = document.querySelector<HTMLImageElement>('img.board-template');
    if (!element) {
        throw new Error('Failed to find template image, this should never happen');
    }
    return element;
}

export function getPxlsUIMouseCoords(): HTMLElement {
    const element = document.querySelector<HTMLElement>('#coords-info > .coords');
    if (!element) {
        throw new Error('Failed to find mouse coords, this should never happen');
    }
    return element;
}

export function getPxlsUIPaletteDeselectButton(): HTMLElement {
    const element = document.querySelector<HTMLElement>('#palette > .palette-button.deselect-button');
    if (!element) {
        throw new Error('Failed to find palette deselect button, this should never happen');
    }
    return element;
}

export function getPxlsUIPaletteSelectionButtons(): HTMLElement[] {
    const paletteButtons: NodeListOf<HTMLElement> = document.querySelectorAll(
        '#palette > .palette-button:not(.deselect-button):not(.palette-button-special)',
    );
    if (paletteButtons.length === 0) {
        throw new Error('Failed to find palette buttons, this should never happen');
    }
    return Array.from(paletteButtons);
}

export function getPxlsUITemplateWidthInput(): HTMLInputElement {
    const element = document.querySelector<HTMLInputElement>('input#template-width');
    if (!element) {
        throw new Error('Failed to find template width input, this should never happen');
    }
    return element;
}

export function getPxlsUITemplateXInput(): HTMLInputElement {
    const element = document.querySelector<HTMLInputElement>('input#template-coords-x');
    if (!element) {
        throw new Error('Failed to find template x input, this should never happen');
    }
    return element;
}

export function getPxlsUITemplateYInput(): HTMLInputElement {
    const element = document.querySelector<HTMLInputElement>('input#template-coords-y');
    if (!element) {
        throw new Error('Failed to find template y input, this should never happen');
    }
    return element;
}

export function getPxlsUITopUI(): HTMLElement {
    const element = document.querySelector<HTMLElement>('#ui > #ui-top');
    if (!element) {
        throw new Error('Failed to find top UI, this should never happen');
    }
    return element;
}

export function getPxlsUIMainBubble(): HTMLElement {
    const element = document.querySelector<HTMLElement>('#ui > #ui-top > #main-bubble');
    if (!element) {
        throw new Error('Failed to find main bubble, this should never happen');
    }
    return element;
}

export function getPxlsUIPlaceableCount(): HTMLElement {
    const element = document.querySelector<HTMLElement>('#placeable-count');
    if (!element) {
        throw new Error('Failed to find placeable count, this should never happen');
    }
    return element;
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
