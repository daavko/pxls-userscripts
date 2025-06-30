import { debug } from './debug';
import { getDpus } from './pxls-init';

export const ADVANCED_TEMPLATE_CHANGE_EVENT_NAME = 'dpus:advancedTemplateChange';

declare global {
    interface WindowEventMap {
        [ADVANCED_TEMPLATE_CHANGE_EVENT_NAME]: CustomEvent<void>;
    }

    interface DPUS {
        advancedTemplate: {
            templateData: AdvancedTemplateData[];
        };
    }
}

function getDpusAdvancedTemplate(): DPUS['advancedTemplate'] {
    const dpus = getDpus();
    dpus.advancedTemplate ??= {
        templateData: [],
    };
    return dpus.advancedTemplate;
}

export interface AdvancedTemplateData {}

export interface PendingAdvancedTemplate {
    status: 'loading';
}

export interface UnavailableAdvancedTemplate {
    status: 'error';
    error: Error;
}

export interface AdvancedTemplate {
    status: 'loaded';
    imageData: ImageData | VideoFrame;
}

function environmentSupportsImageDecoder(): boolean {
    return 'ImageDecoder' in window;
}

async function fetchWithImageDecoder(url: string): Promise<ImageBitmap> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const bodyStream = response.body;
    if (!bodyStream) {
        throw new Error('Response does not contain an image');
    }

    const contentType = response.headers.get('content-type');
    if (contentType == null) {
        throw new Error('Response does not contain a Content-Type header');
    }
    if (!contentType.startsWith('image/')) {
        throw new Error(`Response Content-Type is not an image: ${contentType}`);
    }

    if (!(await ImageDecoder.isTypeSupported(contentType))) {
        throw new Error(`ImageDecoder does not support the content type: ${contentType}`);
    }

    const decoder = new ImageDecoder({ type: contentType, data: bodyStream, premultiplyAlpha: 'premultiply' });
    const decodeResult = await decoder.decode();

    if (decodeResult.complete) {
        const image = decodeResult.image;
        decoder.close();
        return await createImageBitmap(image);
    } else {
        decoder.close();
        throw new Error('Image decoding was not complete');
    }
}

async function fetchWithImageElement(url: string): Promise<ImageBitmap> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();

    const bitmap = await createImageBitmap(img, {
        premultiplyAlpha: 'premultiply',
    });

    URL.revokeObjectURL(img.src);
    return bitmap;
}

async function loadImageAsTemplate(url: string): Promise<ImageData> {
    let bitmap: ImageBitmap;
    if (environmentSupportsImageDecoder()) {
        debug('Using ImageDecoder to fetch image', url);
        bitmap = await fetchWithImageDecoder(url);
    } else {
        debug('Using ImageElement to fetch image', url);
        bitmap = await fetchWithImageElement(url);
    }

    // todo: turn into template
}
