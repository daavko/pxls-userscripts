import { z } from 'zod';
import type { NullableKeys } from '../util/types';
import { debug } from './debug';
import { getApp } from './pxls-init';
import {
    getPxlsUITemplateImage,
    getPxlsUITemplateWidthInput,
    getPxlsUITemplateXInput,
    getPxlsUITemplateYInput,
} from './pxls-ui';

export const TEMPLATE_CHANGE_EVENT_NAME = 'dpus:templateChange';

declare global {
    interface WindowEventMap {
        [TEMPLATE_CHANGE_EVENT_NAME]: CustomEvent<TemplateData | null>;
    }
}

export interface TemplateData {
    src: string;
    width: number;
    x: number;
    y: number;
}

type TemplateChangeData = NullableKeys<TemplateData>;

let lastDispatchedTemplateData: TemplateData | null = null;

const lastKnownTemplateData: TemplateChangeData = {
    src: null,
    width: null,
    x: null,
    y: null,
};

const templateSrcChangeObserver = new MutationObserver((mutations) => {
    const srcMutation = mutations.find((mut) => {
        return mut.type === 'attributes' && mut.attributeName === 'src';
    });
    if (srcMutation) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        const { src: currentSrc } = srcMutation.target as HTMLImageElement;
        const previousSrc = srcMutation.oldValue;
        if (previousSrc !== currentSrc) {
            if (currentSrc === '') {
                changeTemplateDataProperty('src', null);
            } else {
                changeTemplateDataProperty('src', currentSrc);
            }
        }
    }
});
const templateResizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        const { width } = entry.target as HTMLImageElement;
        if (width === 0) {
            changeTemplateDataProperty('width', null);
        } else {
            changeTemplateDataProperty('width', width);
        }
    }
});

function changeTemplateDataProperty<K extends keyof TemplateChangeData>(key: K, value: TemplateChangeData[K]): void {
    if (lastKnownTemplateData[key] !== value) {
        debug(`Template data changed: ${key}`, lastKnownTemplateData[key], value);
        lastKnownTemplateData[key] = value;
        maybeDispatchTemplateChangeEvent();
    }
}

function isTemplateChangeDataComplete(data: TemplateChangeData): data is TemplateData {
    return data.src !== null && data.width !== null && data.x !== null && data.y !== null;
}

function maybeDispatchTemplateChangeEvent(): void {
    const dataIsComplete = isTemplateChangeDataComplete(lastKnownTemplateData);
    if (dataIsComplete && lastDispatchedTemplateData !== null) {
        const isDifferent =
            lastDispatchedTemplateData.src !== lastKnownTemplateData.src ||
            lastDispatchedTemplateData.width !== lastKnownTemplateData.width ||
            lastDispatchedTemplateData.x !== lastKnownTemplateData.x ||
            lastDispatchedTemplateData.y !== lastKnownTemplateData.y;
        if (isDifferent) {
            dispatchTemplateChangeEvent({ ...lastKnownTemplateData });
        }
    } else if (dataIsComplete && lastDispatchedTemplateData === null) {
        dispatchTemplateChangeEvent({ ...lastKnownTemplateData });
    } else if (!dataIsComplete && lastDispatchedTemplateData !== null) {
        dispatchTemplateChangeEvent(null);
    }
}

function dispatchTemplateChangeEvent(data: TemplateData | null): void {
    const event = new CustomEvent<TemplateData | null>(TEMPLATE_CHANGE_EVENT_NAME, {
        detail: data,
    });
    debug('Dispatching template change event', data);
    lastDispatchedTemplateData = data;
    window.dispatchEvent(event);
}

function parseQueryParameterValue(value: string | null): number | null {
    if (value == null) {
        return null;
    }

    const parsedValue = Number.parseInt(value, 10);
    if (Number.isNaN(parsedValue)) {
        return null;
    }

    return parsedValue;
}

export function initTemplateEventHandlers(): void {
    getPxlsUITemplateWidthInput().addEventListener('change', function () {
        const value = this.valueAsNumber;
        if (Number.isNaN(value) || value <= 0) {
            changeTemplateDataProperty('width', null);
        } else {
            changeTemplateDataProperty('width', value);
        }
    });
    getPxlsUITemplateXInput().addEventListener('change', function () {
        const value = this.valueAsNumber;
        if (Number.isNaN(value)) {
            changeTemplateDataProperty('x', null);
        } else {
            changeTemplateDataProperty('x', value);
        }
    });
    getPxlsUITemplateYInput().addEventListener('change', function () {
        const value = this.valueAsNumber;
        if (Number.isNaN(value)) {
            changeTemplateDataProperty('y', null);
        } else {
            changeTemplateDataProperty('y', value);
        }
    });

    const pxlsQueryUpdatedSchema = z.object({
        parameter: z.string(),
        value: z.string().nullable(),
    });
    $(window).on('pxls:queryUpdated', (_e, parameterName: unknown, oldValue: unknown, newValue: unknown) => {
        if (oldValue === newValue) {
            return;
        }

        debug('pxls:queryUpdated', parameterName, oldValue, newValue);
        const { parameter, value } = pxlsQueryUpdatedSchema.parse({
            parameter: parameterName,
            value: newValue,
        });

        switch (parameter) {
            case 'tw': {
                const parsedWidth = parseQueryParameterValue(value);
                changeTemplateDataProperty('width', parsedWidth);
                break;
            }
            case 'ox': {
                const parsedX = parseQueryParameterValue(value);
                changeTemplateDataProperty('x', parsedX);
                break;
            }
            case 'oy': {
                const parsedY = parseQueryParameterValue(value);
                changeTemplateDataProperty('y', parsedY);
                break;
            }
        }
    });

    const templateImage = getPxlsUITemplateImage();
    templateSrcChangeObserver.observe(templateImage, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['src'],
    });
    templateResizeObserver.observe(templateImage);
    const currentSrc = templateImage.src;
    if (currentSrc !== '') {
        changeTemplateDataProperty('src', currentSrc);
    }

    const app = getApp();
    changeTemplateDataProperty('width', parseQueryParameterValue(app.query.get('tw') ?? null));
    changeTemplateDataProperty('x', parseQueryParameterValue(app.query.get('ox') ?? null));
    changeTemplateDataProperty('y', parseQueryParameterValue(app.query.get('oy') ?? null));
}

export function getCurrentTemplate(): TemplateData | null {
    if (lastDispatchedTemplateData) {
        return { ...lastDispatchedTemplateData };
    } else {
        return null;
    }
}
