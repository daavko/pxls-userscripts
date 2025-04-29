import { workerDebug, workerDebugTime } from './debug';
import { type DetemplatizeResultMessage, isDetemplatizeMessage } from './detemplatization.schemas';
import { bindInitEvent } from './init';
import { DEFAULT_BROKEN_WORKER } from './util';

function bindDetemplatizeEvent(): void {
    globalThis.addEventListener('message', ({ data }: MessageEvent<object>) => {
        if (!isDetemplatizeMessage(data)) {
            return;
        }

        try {
            const { image, targetWidth } = data;
            const targetImage = processDetemplatizeImage(image, targetWidth);
            globalThis.postMessage({
                type: 'detemplatizeResult',
                success: true,
                image: targetImage,
            } satisfies DetemplatizeResultMessage);
        } catch (e: unknown) {
            if (e instanceof Error) {
                globalThis.postMessage({
                    type: 'detemplatizeResult',
                    success: false,
                    error: e,
                } satisfies DetemplatizeResultMessage);
            } else {
                globalThis.postMessage({
                    type: 'detemplatizeResult',
                    success: false,
                    error: new Error('Unknown error', { cause: e }),
                } satisfies DetemplatizeResultMessage);
            }
        }
    });
}

function processDetemplatizeImage(image: ImageData, targetWidth: number): ImageData {
    const debugTimer = workerDebugTime('processDetemplatizeImage');

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
    workerDebug(`Target image size: ${targetWidth}x${targetHeight}`);

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

bindInitEvent();
bindDetemplatizeEvent();

export default DEFAULT_BROKEN_WORKER;
