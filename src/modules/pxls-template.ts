import { getPxlsUITemplateWidthInput, getPxlsUITemplateXInput, getPxlsUITemplateYInput } from './pxls-ui';

type NumericValueChangeCallback = (num: number | null) => void;

let currentTemplateWidth: number | null = null;
let currentTemplateX: number | null = null;
let currentTemplateY: number | null = null;
const TEMPLATE_WIDTH_CALLBACKS = new Set<NumericValueChangeCallback>();
const TEMPLATE_X_CALLBACKS = new Set<NumericValueChangeCallback>();
const TEMPLATE_Y_CALLBACKS = new Set<NumericValueChangeCallback>();

function createGenericNumericValueChangeHandler(
    inputGetter: () => HTMLInputElement,
    valueGetter: () => number | null,
    valueSetter: (val: number | null) => void,
    callbacks: Set<NumericValueChangeCallback>,
): () => void {
    return () => {
        const input = inputGetter();
        const newValue = input.valueAsNumber;

        if (newValue === valueGetter()) {
            return;
        }

        if (Number.isNaN(newValue)) {
            valueSetter(null);
        } else {
            valueSetter(newValue);
        }

        for (const callback of callbacks) {
            callback(newValue);
        }
    };
}

const templateWidthChangeHandler = createGenericNumericValueChangeHandler(
    getPxlsUITemplateWidthInput,
    () => currentTemplateWidth,
    (val) => {
        currentTemplateWidth = val;
    },
    TEMPLATE_WIDTH_CALLBACKS,
);
const templateXChangeHandler = createGenericNumericValueChangeHandler(
    getPxlsUITemplateXInput,
    () => currentTemplateX,
    (val) => {
        currentTemplateX = val;
    },
    TEMPLATE_WIDTH_CALLBACKS,
);
const templateYChangeHandler = createGenericNumericValueChangeHandler(
    getPxlsUITemplateYInput,
    () => currentTemplateY,
    (val) => {
        currentTemplateY = val;
    },
    TEMPLATE_WIDTH_CALLBACKS,
);

export function initTemplateEventHandlers(): void {
    const widthInput = getPxlsUITemplateWidthInput();
    widthInput.addEventListener('change', templateWidthChangeHandler);
    templateWidthChangeHandler();

    const xInput = getPxlsUITemplateXInput();
    xInput.addEventListener('change', templateXChangeHandler);
    templateXChangeHandler();

    const yInput = getPxlsUITemplateYInput();
    yInput.addEventListener('change', templateYChangeHandler);
    templateYChangeHandler();
}

export function getTemplateWidth(): number | null {
    return currentTemplateWidth;
}

export function watchTemplateWidth(callback: NumericValueChangeCallback, callWithCurrentValue = true): void {
    TEMPLATE_WIDTH_CALLBACKS.add(callback);
    if (callWithCurrentValue) {
        callback(currentTemplateWidth);
    }
}

export function unwatchTemplateWidth(callback: NumericValueChangeCallback): void {
    TEMPLATE_WIDTH_CALLBACKS.delete(callback);
}

export function getTemplateX(): number | null {
    return currentTemplateX;
}

export function watchTemplateX(callback: NumericValueChangeCallback, callWithCurrentValue = true): void {
    TEMPLATE_X_CALLBACKS.add(callback);
    if (callWithCurrentValue) {
        callback(currentTemplateX);
    }
}

export function unwatchTemplateX(callback: NumericValueChangeCallback): void {
    TEMPLATE_X_CALLBACKS.delete(callback);
}

export function getTemplateY(): number | null {
    return currentTemplateY;
}

export function watchTemplateY(callback: NumericValueChangeCallback, callWithCurrentValue = true): void {
    TEMPLATE_Y_CALLBACKS.add(callback);
    if (callWithCurrentValue) {
        callback(currentTemplateY);
    }
}

export function unwatchTemplateY(callback: NumericValueChangeCallback): void {
    TEMPLATE_Y_CALLBACKS.delete(callback);
}
