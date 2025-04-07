import { workerDebug, workerDebugEnabled, workerDebugName, workerDebugTime } from '../util/worker';
import { debug, debugTime } from './debug';
import { hashInWorker } from './hash';
import { getPxlsUITemplateImage } from './pxls-ui';
import { getGlobalSettings } from './settings';

type TemplateChangeCallback = (previousSrc: string | null, currentSrc: string, img: HTMLImageElement) => void;

const TEMPLATE_CHANGE_CALLBACKS = new Set<TemplateChangeCallback>();
const templateChangeObserver = new MutationObserver((mutations) => {
    const srcMutation = mutations.find((mut) => {
        return mut.type === 'attributes' && mut.attributeName === 'src';
    });
    if (srcMutation) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        const img = srcMutation.target as HTMLImageElement;
        const previousSrc = srcMutation.oldValue;
        const currentSrc = img.src;
        if (previousSrc !== currentSrc) {
            debug(`Template image src changed from ${previousSrc} to ${currentSrc}`);
            for (const callback of TEMPLATE_CHANGE_CALLBACKS) {
                callback(previousSrc, currentSrc, img);
            }
        }
    }
});

export function watchTemplateImage(callback: TemplateChangeCallback, callWithCurrentValue = true): void {
    TEMPLATE_CHANGE_CALLBACKS.add(callback);
    const img = getPxlsUITemplateImage();
    if (TEMPLATE_CHANGE_CALLBACKS.size === 1) {
        templateChangeObserver.observe(img, {
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ['src'],
        });
    }
    if (callWithCurrentValue) {
        callback(null, img.src, img);
    }
}

export function unwatchTemplateImage(callback: TemplateChangeCallback): void {
    TEMPLATE_CHANGE_CALLBACKS.delete(callback);
    if (TEMPLATE_CHANGE_CALLBACKS.size === 0) {
        templateChangeObserver.disconnect();
    }
}

export async function getTemplateImage(): Promise<ImageData> {
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
    return imageData;
}

const DETEMPLATIZE_CACHE_SIZE = 10;
const DETEMPLATIZE_CACHE = new Map<string, ImageData>();

function addToDetemplatizeCache(key: string, image: ImageData): void {
    while (DETEMPLATIZE_CACHE.size >= DETEMPLATIZE_CACHE_SIZE) {
        const firstKey = DETEMPLATIZE_CACHE.keys().next().value!;
        DETEMPLATIZE_CACHE.delete(firstKey);
    }
    DETEMPLATIZE_CACHE.set(key, image);
}

function getFromDetemplatizeCache(key: string): ImageData | undefined {
    return DETEMPLATIZE_CACHE.get(key);
}

const DETEMPLATIZE_WORKER_NAME = 'detemplatizeImageWorker';
const DETEMPLATIZE_WORKER_SCRIPT = `
let debugEnabled = false;
let ${workerDebugEnabled.name} = () => debugEnabled;
let ${workerDebugName.name} = () => '${DETEMPLATIZE_WORKER_NAME}';
const ${debug.name} = ${workerDebug.toString()};
const ${debugTime.name} = ${workerDebugTime.toString()}

self.onmessage = (e) => {
    const { image, targetWidth } = e.data;
    debugEnabled = e.data.debugEnabled;
    
    try {
        const targetImage = ${detemplatizeImage.name}(image, targetWidth);
        self.postMessage({ type: 'success', image: targetImage });
    } catch (error) {
        console.error('Error in worker:', error);
        self.postMessage({ type: 'error', error });
    }
}

${detemplatizeImage.toString()}

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

export async function detemplatizeImageWorker(image: ImageData, targetWidth: number): Promise<ImageData> {
    const imageHash = await hashInWorker(image.data);
    const cachedImage = getFromDetemplatizeCache(imageHash);
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
                    debug(`Worker returned unknown result: ${String(e.data as unknown)}`);
                    reject(new Error(`Worker returned unknown result: ${String(e.data as unknown)}`));
            }
        };

        worker.onerror = (e): void => {
            reject(new Error(`Worker error: ${e.message}`, { cause: e.error }));
        };

        worker.postMessage({ image, targetWidth, debugEnabled: getGlobalSettings().get('debug') });
    });
    void resultPromise.finally(() => {
        worker.terminate();
        URL.revokeObjectURL(workerObjectURL);
        debugTimer?.stop();
    });
    void resultPromise.then((result) => {
        addToDetemplatizeCache(imageHash, result);
    });
    return resultPromise;
}

export function detemplatizeImage(image: ImageData, targetWidth: number): ImageData {
    const debugTimer = debugTime('detemplatizeImage');

    const scaleFactor = image.width / targetWidth;
    if (!Number.isInteger(scaleFactor)) {
        debugTimer?.stop();
        debug(`Non-integer scale factor for image width ${image.width}, target width ${targetWidth}: ${scaleFactor}`);
        throw new Error('Template image width does not divide evenly by target width');
    } else if (image.height % scaleFactor !== 0) {
        debugTimer?.stop();
        debug(
            `Image height ${image.height} is not a multiple of scale factor ${scaleFactor}, target width ${targetWidth}`,
        );
        throw new Error('Template height is not a multiple of scale factor');
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
                debug(
                    `Pixel block for downscaling (position ${x}, ${y}, scaled ${cellSize}x) has alpha value other than 0 or 255 (actual: ${a})`,
                );
                throw new Error('Pixel block for downscaling has alpha value other than 0 or 255');
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
                    debug(
                        `Pixel block for downscaling (position ${x}, ${y}; block position ${blockX}, ${blockY}; scaled ${cellSize}x) has more than one color (previous: ${previousR}, ${previousG}, ${previousB}, current: ${r}, ${g}, ${b})`,
                    );
                    throw new Error(
                        'Pixel block for downscaling has more than one color. If you have Firefox Enhanced Tracking Protection enabled, try disabling it for this site.',
                    );
                }
            } else {
                pixel = pixelColor;
            }
        }
    }

    return pixel;
}
