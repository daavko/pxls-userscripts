import { createSetDebugEnabledShim, createWorkerDebugShim } from '../util/worker';
import { debug, debugEnabled, debugTime } from './debug';
import { hashInWorker } from './hash';
import { getPxlsUITemplateImage } from './pxls-ui';

export interface TemplateImage {
    url: string;
    imageData: ImageData;
}

export async function getTemplateImage(): Promise<TemplateImage> {
    const debugTimer = debugTime('getTemplateImage');

    const img = getPxlsUITemplateImage();
    await img.decode();

    const { naturalWidth: imgWidth, naturalHeight: imgHeight } = img;
    debug(`Template image size: ${imgWidth}x${imgHeight}`);

    if (imgWidth <= 0 || imgHeight <= 0) {
        debugTimer?.stop();
        throw new Error('Template image has invalid size after decoding, this should never happen');
    }

    const imgCanvas = new OffscreenCanvas(imgWidth, imgHeight);
    const ctx = imgCanvas.getContext('2d');
    if (!ctx) {
        debugTimer?.stop();
        throw new Error('Failed to get 2D context for template image canvas');
    }
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight);

    debugTimer?.stop();
    return {
        url: img.src,
        imageData,
    };
}

const DETEMPLATIZE_CACHE_SIZE = 10;
const DETEMPLATIZE_CACHE = new Map<string, ImageData>();

function createDetemplatizeCacheKey(key: string, targetWidth: number): string {
    return `${key}-${targetWidth}`;
}

function addToDetemplatizeCache(key: string, targetWidth: number, image: ImageData): void {
    while (DETEMPLATIZE_CACHE.size >= DETEMPLATIZE_CACHE_SIZE) {
        const firstKey = DETEMPLATIZE_CACHE.keys().next().value!;
        DETEMPLATIZE_CACHE.delete(firstKey);
    }
    DETEMPLATIZE_CACHE.set(createDetemplatizeCacheKey(key, targetWidth), image);
}

function getFromDetemplatizeCache(key: string, targetWidth: number): ImageData | undefined {
    return DETEMPLATIZE_CACHE.get(createDetemplatizeCacheKey(key, targetWidth));
}

const DETEMPLATIZE_WORKER_SCRIPT = `
${createWorkerDebugShim('detemplatizeImageWorker')}

self.onmessage = (e) => {
    const { image, targetWidth } = e.data;
    ${createSetDebugEnabledShim()}

    try {
        const targetImage = ${processDetemplatizeImage.name}(image, targetWidth);
        self.postMessage({ type: 'success', image: targetImage });
    } catch (error) {
        self.postMessage({ type: 'error', error });
    }
}

${processDetemplatizeImage.toString()}

${getCellColor.toString()}
`;

interface DetemplatizeWorkerErrorResult {
    type: 'error';
    error: Error;
}

interface DetemplatizeWorkerSuccessResult {
    type: 'success';
    image: ImageData;
}

type DetemplatizeWorkerResult = DetemplatizeWorkerErrorResult | DetemplatizeWorkerSuccessResult;

export async function detemplatizeImageWorker(template: TemplateImage, targetWidth: number): Promise<ImageData> {
    if (template.imageData.width === targetWidth || targetWidth === -1) {
        // no need to detemplatize if the image is already the right size
        return template.imageData;
    }

    if (template.url.startsWith('data:')) {
        // data URLs are cacheable directly without hashing, since they are already unique
        const cachedImage = getFromDetemplatizeCache(template.url, targetWidth);
        if (cachedImage) {
            debug('Using cached image for data URL', template.url);
            return cachedImage;
        }
    }

    const imageHash = await hashInWorker(template.imageData.data);
    const cachedImage = getFromDetemplatizeCache(imageHash, targetWidth);
    if (cachedImage) {
        debug(`Using cached image for hash ${imageHash}`);
        return cachedImage;
    }

    const debugTimer = debugTime('detemplatizeImageWorker');
    const workerBlob = new Blob([DETEMPLATIZE_WORKER_SCRIPT], { type: 'application/javascript' });
    const workerObjectURL = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerObjectURL);
    const resultPromise = new Promise<ImageData>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<DetemplatizeWorkerResult>): void => {
            switch (e.data.type) {
                case 'success':
                    resolve(e.data.image);
                    break;
                case 'error':
                    reject(e.data.error);
                    break;
                default:
                    reject(new Error('Detemplatize worker returned unknown result', { cause: e.data }));
            }
        };

        worker.onerror = (e): void => {
            reject(new Error('Unknown detemplatize worker error', { cause: e.error }));
        };

        worker.postMessage({ image: template.imageData, targetWidth, debugEnabled: debugEnabled() });
    });
    void resultPromise.finally(() => {
        worker.terminate();
        URL.revokeObjectURL(workerObjectURL);
        debugTimer?.stop();
    });
    void resultPromise.then((result) => {
        if (template.url.startsWith('data:')) {
            addToDetemplatizeCache(template.url, targetWidth, result);
        } else {
            addToDetemplatizeCache(imageHash, targetWidth, result);
        }
    });
    return resultPromise;
}

function processDetemplatizeImage(image: ImageData, targetWidth: number): ImageData {
    const debugTimer = debugTime('processDetemplatizeImage');

    const scaleFactor = image.width / targetWidth;
    if (!Number.isInteger(scaleFactor)) {
        debugTimer?.stop();
        throw new Error('Template image width does not divide evenly by target width', {
            cause: { width: image.width, targetWidth, scaleFactor },
        });
    } else if (image.height % scaleFactor !== 0) {
        debugTimer?.stop();
        throw new Error('Template height is not a multiple of scale factor', {
            cause: { height: image.height, targetWidth, scaleFactor },
        });
    }

    const targetHeight = image.height / scaleFactor;
    debug(`Target image size: ${targetWidth}x${targetHeight}`);

    const targetImage = new ImageData(targetWidth, targetHeight);
    const imageUInt32View = new Uint32Array(image.data.buffer);
    const targetImageUInt32View = new Uint32Array(targetImage.data.buffer);

    try {
        for (let y = 0; y < targetHeight; y++) {
            for (let x = 0; x < targetWidth; x++) {
                const color = getCellColor(image, imageUInt32View, x * scaleFactor, y * scaleFactor, scaleFactor);
                if (color != null) {
                    const i = y * targetWidth + x;
                    targetImageUInt32View[i] = color;
                }
            }
        }
    } catch (e) {
        debugTimer?.stop();
        throw e;
    }

    debugTimer?.stop();
    return targetImage;
}

function getCellColor(
    imageData: ImageData,
    uInt32View: Uint32Array,
    x: number,
    y: number,
    cellSize: number,
): number | null {
    const { width } = imageData;
    let pixel: number | null = null;

    for (let blockY = 0; blockY < cellSize; blockY++) {
        const rowStart = (y + blockY) * width;
        for (let blockX = 0; blockX < cellSize; blockX++) {
            const pixelIndex = rowStart + (x + blockX);
            const pixelColor = uInt32View[pixelIndex];
            const a = imageData.data[pixelIndex * 4 + 3];
            if (a === 0) {
                continue;
            }
            if (a !== 255) {
                throw new Error('Pixel block for downscaling has alpha value other than 0 or 255', {
                    cause: { x, y, cellSize, a },
                });
            }

            if (pixel != null) {
                if (pixel !== pixelColor) {
                    // the pixels are packed as AABBGGRR because little-endian
                    const previousB = (pixel >> 16) & 0xff;
                    const previousG = (pixel >> 8) & 0xff;
                    const previousR = pixel & 0xff;
                    const b = (pixelColor >> 16) & 0xff;
                    const g = (pixelColor >> 8) & 0xff;
                    const r = pixelColor & 0xff;
                    throw new Error(
                        'Pixel block for downscaling has more than one color. If you have Firefox Enhanced Tracking Protection enabled, try disabling it for this site.',
                        { cause: { x, y, blockX, blockY, cellSize, previousR, previousG, previousB, r, g, b } },
                    );
                }
            } else {
                pixel = pixelColor;
            }
        }
    }

    return pixel;
}
