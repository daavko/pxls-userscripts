import * as v from 'valibot';
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

let eventsBound = false;
let lastDispatchedTemplateData: TemplateData | null = null;

export interface TemplateData {
    src: string;
    width: number;
    x: number;
    y: number;
}

type TemplateChangeData = NullableKeys<TemplateData>;

const lastKnownTemplateData: TemplateChangeData = {
    src: null,
    width: null,
    x: null,
    y: null,
};

const templateMutationObserver = new MutationObserver((mutations) => {
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

    const classMutation = mutations.find((mut) => {
        return mut.type === 'attributes' && mut.attributeName === 'class';
    });
    if (classMutation) {
        runNumericTemplateParameterChanges();
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
    const lastDispatchedData = lastDispatchedTemplateData;
    if (dataIsComplete && lastDispatchedData !== null) {
        const isDifferent =
            lastDispatchedData.src !== lastKnownTemplateData.src ||
            lastDispatchedData.width !== lastKnownTemplateData.width ||
            lastDispatchedData.x !== lastKnownTemplateData.x ||
            lastDispatchedData.y !== lastKnownTemplateData.y;
        if (isDifferent) {
            dispatchTemplateChangeEvent({ ...lastKnownTemplateData });
        }
    } else if (dataIsComplete && lastDispatchedData === null) {
        dispatchTemplateChangeEvent({ ...lastKnownTemplateData });
    } else if (!dataIsComplete && lastDispatchedData !== null) {
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

function runNumericTemplateParameterChanges(): void {
    const app = getApp();
    changeTemplateDataProperty('width', parseQueryParameterValue(app.query.get('tw') ?? null));
    changeTemplateDataProperty('x', parseQueryParameterValue(app.query.get('ox') ?? null));
    changeTemplateDataProperty('y', parseQueryParameterValue(app.query.get('oy') ?? null));
}

export function initTemplateEventHandlers(): void {
    const bindEvents = !eventsBound;

    if (bindEvents) {
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
            changeTemplateDataProperty('x', Number.isNaN(value) ? null : value);
        });
        getPxlsUITemplateYInput().addEventListener('change', function () {
            const value = this.valueAsNumber;
            changeTemplateDataProperty('y', Number.isNaN(value) ? null : value);
        });

        const pxlsQueryUpdatedSchema = v.object({
            parameter: v.string(),
            value: v.nullable(v.string()),
        });
        $(window).on('pxls:queryUpdated', (_e, parameterName: unknown, oldValue: unknown, newValue: unknown) => {
            if (oldValue === newValue) {
                return;
            }

            debug('pxls:queryUpdated', parameterName, oldValue, newValue);
            const { parameter, value } = v.parse(pxlsQueryUpdatedSchema, {
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
    }

    const templateImage = getPxlsUITemplateImage();
    if (bindEvents) {
        templateMutationObserver.observe(templateImage, {
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ['src', 'class'],
        });
    }

    const currentSrc = templateImage.src;
    if (currentSrc !== '') {
        changeTemplateDataProperty('src', currentSrc);
    }

    runNumericTemplateParameterChanges();

    eventsBound = true;
}

export function getCurrentTemplate(): TemplateData | null {
    if (lastDispatchedTemplateData) {
        return { ...lastDispatchedTemplateData };
    } else {
        return null;
    }
}
