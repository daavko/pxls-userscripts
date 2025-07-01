import { createWorker } from '../util/worker';
import { type DetemplatizeMessage, isDetemplatizeResultMessage } from '../workers/detemplatization.schemas';
import detemplatizeWorkerCode from '../workers/detemplatization.worker';
import { debug, debugTime } from './debug';
import { hash } from './hash';
import { getDpus } from './pxls-init';
import { getPxlsUITemplateImage } from './pxls-ui';

declare global {
    interface DPUS {
        template: {
            templateImageCache: Map<string, TemplateImage>;
            detemplatizeCache: Map<string, Promise<ImageData>>;
        };
    }
}

function getDpusTemplate(): DPUS['template'] {
    const dpus = getDpus();
    dpus.template ??= {
        templateImageCache: new Map(),
        detemplatizeCache: new Map(),
    };
    return dpus.template;
}

const TEMPLATE_IMAGE_CACHE_SIZE = 10;
const DETEMPLATIZE_CACHE_SIZE = 10;

function addToTemplateImageCache(key: string, image: TemplateImage): void {
    const cache = getDpusTemplate().templateImageCache;
    const keysToDrop = Math.max(0, cache.size - TEMPLATE_IMAGE_CACHE_SIZE + 1);
    for (const droppedKey of cache.keys().take(keysToDrop)) {
        cache.delete(droppedKey);
    }

    cache.set(key, image);
}

function getFromTemplateImageCache(key: string): TemplateImage | undefined {
    return getDpusTemplate().templateImageCache.get(key);
}

function createDetemplatizeCacheKey(key: string, targetWidth: number): string {
    return `${key}-${targetWidth}`;
}

function addToDetemplatizeCache(key: string, targetWidth: number, image: Promise<ImageData>): void {
    const cache = getDpusTemplate().detemplatizeCache;
    const keysToDrop = Math.max(0, cache.size - DETEMPLATIZE_CACHE_SIZE + 1);
    for (const droppedKey of cache.keys().take(keysToDrop)) {
        cache.delete(droppedKey);
    }

    cache.set(createDetemplatizeCacheKey(key, targetWidth), image);
}

function getFromDetemplatizeCache(key: string, targetWidth: number): Promise<ImageData> | undefined {
    return getDpusTemplate().detemplatizeCache.get(createDetemplatizeCacheKey(key, targetWidth));
}

export interface TemplateImage {
    url: string;
    imageData: ImageData;
}

export async function getTemplateImage(): Promise<TemplateImage> {
    const img = getPxlsUITemplateImage();
    const cachedImage = getFromTemplateImageCache(img.src);
    if (cachedImage) {
        debug('Using cached template image', img.src);
        return cachedImage;
    }

    const debugTimer = debugTime('getTemplateImage');

    await img.decode();

    const imageBitmap = await createImageBitmap(img);

    const { width: imgWidth, height: imgHeight } = imageBitmap;
    debug(`Template image size: ${imgWidth}x${imgHeight}`);

    if (imgWidth <= 0 || imgHeight <= 0) {
        debugTimer?.stop();
        throw new Error('Template image has invalid size after decoding, this should never happen');
    }

    const imgCanvas = new OffscreenCanvas(imgWidth, imgHeight);
    const ctx = imgCanvas.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get 2D context for template image canvas');
    }
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);

    const templateImage: TemplateImage = {
        url: img.src,
        imageData,
    };
    addToTemplateImageCache(img.src, templateImage);

    debugTimer?.stop();
    return templateImage;
}

async function getCachedImage(template: TemplateImage, targetWidth: number): Promise<ImageData | undefined> {
    if (template.url.startsWith('data:')) {
        // data URLs are cacheable directly without hashing, since they are already unique
        const cachedImage = getFromDetemplatizeCache(template.url, targetWidth);
        if (cachedImage) {
            debug('Have cached image for data URL', template.url);
            return cachedImage;
        }
    } else {
        const imageHash = await hash(template.imageData.data);
        const cachedImage = getFromDetemplatizeCache(imageHash, targetWidth);
        if (cachedImage) {
            debug(`Have cached image for hash ${imageHash}`);
            return cachedImage;
        }
    }
    return undefined;
}

function createMessageHandler(resolve: (image: ImageData) => void, reject: (error: unknown) => void) {
    return ({ data }: MessageEvent<object>): void => {
        if (!isDetemplatizeResultMessage(data)) {
            return;
        }

        const { success, image, error } = data;
        if (success) {
            resolve(image);
        } else {
            reject(error);
        }
    };
}

function createMessageErrorHandler(reject: (error: unknown) => void) {
    return (e: MessageEvent): void => {
        reject(new Error('Unknown detemplatize worker error', { cause: e }));
    };
}

function createErrorHandler(reject: (error: unknown) => void) {
    return (e: ErrorEvent): void => {
        reject(new Error('Unknown detemplatize worker error', { cause: e.error }));
    };
}

export async function detemplatizeImage(template: TemplateImage, targetWidth: number): Promise<ImageData> {
    if (template.imageData.width === targetWidth || targetWidth === -1) {
        // no need to detemplatize if the image is already the right size
        return template.imageData;
    }

    const cachedImage = await getCachedImage(template, targetWidth);
    if (cachedImage) {
        debug('Using cached detemplatized image');
        return cachedImage;
    }

    const { worker, terminate } = createWorker(detemplatizeWorkerCode);
    const { promise: resultPromise, resolve, reject } = Promise.withResolvers<ImageData>();

    worker.addEventListener('message', createMessageHandler(resolve, reject));
    worker.addEventListener('messageerror', createMessageErrorHandler(reject));
    worker.addEventListener('error', createErrorHandler(reject));

    const debugTimer = debugTime('detemplatizeImage');
    worker.postMessage({
        type: 'detemplatize',
        image: template.imageData,
        targetWidth,
    } satisfies DetemplatizeMessage);

    void resultPromise.finally(() => {
        terminate();
        debugTimer?.stop();
    });

    if (template.url.startsWith('data:')) {
        addToDetemplatizeCache(template.url, targetWidth, resultPromise);
    } else {
        addToDetemplatizeCache(await hash(template.imageData.data), targetWidth, resultPromise);
    }
    return resultPromise;
}
