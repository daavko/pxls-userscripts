import { debug, debugTime } from './debug';
import { getDpus } from './pxls-init';
import { detemplatizeImage } from './template';

export const ADVANCED_TEMPLATE_CHANGE_EVENT_NAME = 'dpus:advancedTemplateChange';

declare global {
    interface WindowEventMap {
        [ADVANCED_TEMPLATE_CHANGE_EVENT_NAME]: CustomEvent<void>;
    }

    interface DPUS {
        advancedTemplate: {
            templates: readonly Readonly<AdvancedTemplate>[];
            visibleResult: Readonly<TemplateImage> | null;
        };
    }
}

function getDpusAdvancedTemplate(): DPUS['advancedTemplate'] {
    const dpus = getDpus();
    dpus.advancedTemplate ??= {
        templates: [],
        visibleResult: null,
    };
    return dpus.advancedTemplate;
}

export interface PendingAdvancedTemplate {
    status: 'loading';
    url: string;
    loadPromise: Promise<void>;
}

export interface UnavailableAdvancedTemplate {
    status: 'error';
    url: string;
    error: Error;
}

export interface LoadedAdvancedTemplate {
    status: 'loaded';
    url: string;
    image: ImageData;
    enabled: boolean;
}

export type AdvancedTemplate = PendingAdvancedTemplate | UnavailableAdvancedTemplate | LoadedAdvancedTemplate;

export interface TemplateImage {
    templateImage: ImageData;
    styleImage: ImageData;
}

export function toggleTemplateEnabled(index: number): void {
    const dpus = getDpusAdvancedTemplate();
    if (index < 0 || index >= dpus.templates.length) {
        throw new Error(`Invalid template index: ${index}`);
    }

    const template = dpus.templates[index];
    if (template.status !== 'loaded') {
        throw new Error(`Template at index ${index} is not loaded`);
    }

    const templates: AdvancedTemplate[] = [...dpus.templates];
    templates[index] = {
        ...template,
        enabled: !template.enabled,
    };
    dpus.templates = templates;
    dispatchEvent(new CustomEvent(ADVANCED_TEMPLATE_CHANGE_EVENT_NAME));
}

export function addTemplate(template: AdvancedTemplate): void {
    const dpus = getDpusAdvancedTemplate();

    dpus.templates = [...dpus.templates, template];
    dispatchEvent(new CustomEvent(ADVANCED_TEMPLATE_CHANGE_EVENT_NAME));
}

function environmentSupportsImageDecoder(): boolean {
    return 'ImageDecoder' in window;
}

async function fetchWithImageDecoder(url: string): Promise<ImageData> {
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

    const decodeTimer = debugTime('templateImageDecoder');
    const decoder = new ImageDecoder({ type: contentType, data: bodyStream, premultiplyAlpha: 'premultiply' });
    const decodeResult = await decoder.decode();
    decodeTimer?.stop();

    if (decodeResult.complete) {
        const image = decodeResult.image;
        const { displayWidth: width, displayHeight: height } = image;
        const imageData = new ImageData(width, height);
        await image.copyTo(imageData.data, {
            format: 'RGBA',
        });
        decoder.close();
        image.close();
        return imageData;
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
    const imageUrl = URL.createObjectURL(blob);

    const decodeTimer = debugTime('templateImageElementDecode');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    await img.decode();
    decodeTimer?.stop();

    const bitmap = await createImageBitmap(img, {
        premultiplyAlpha: 'premultiply',
    });

    URL.revokeObjectURL(imageUrl);
    return bitmap;
}

async function loadImageAsTemplate(url: string, targetWidth: number): Promise<ImageData> {
    if (environmentSupportsImageDecoder()) {
        debug('Using ImageDecoder to fetch image', url);
        const imageData = await fetchWithImageDecoder(url);
        return await detemplatizeImage({ url, imageData }, targetWidth);
    } else {
        debug('Using Image element to fetch image', url);
        const bitmap = await fetchWithImageElement(url);

        const { width: imgWidth, height: imgHeight } = bitmap;
        debug(`Template image size: ${imgWidth}x${imgHeight}`);

        if (imgWidth <= 0 || imgHeight <= 0) {
            throw new Error('Template image has invalid size after decoding, this should never happen');
        }

        const canvas = new OffscreenCanvas(imgWidth, imgHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get BitmapRenderer context for template image canvas');
        }
        ctx.drawImage(bitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);
        bitmap.close();

        return await detemplatizeImage({ url, imageData }, targetWidth);
    }
}
