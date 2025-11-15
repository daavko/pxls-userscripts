import { debug } from '../modules/debug';
import { Messenger } from '../modules/message';
import {
    type FullTemplateContext,
    getCurrentTemplate,
    TEMPLATE_CHANGE_EVENT_NAME,
    type TemplateData,
} from '../modules/pxls-template';
import {
    getPxlsUIBoard,
    getPxlsUIVirginmapBoard,
    waitForBoardLoaded,
    waitForHeatmapLoaded,
    waitForVirginmapLoaded,
} from '../modules/pxls-ui';
import { createSettingsButton, createSettingsUI } from '../modules/settings-ui';
import { detemplatizeImage, getTemplateImage } from '../modules/template';
import { PxlsUserscript } from './userscript';

export class PogpegaUtils extends PxlsUserscript {
    override readonly requiresVirginmap = true;

    private readonly messenger = new Messenger('Pogpega utils');

    private templateContext: FullTemplateContext | null = null;

    constructor() {
        super('Pogpega Utils', undefined, async () => this.initAfterApp());
    }

    private initSettings(): void {
        createSettingsUI('pogpegaUtils', 'DPUS Pogpega Utils', () => [
            createSettingsButton('Copy template with virgin abuse', () => {
                this.copyTemplate(true);
            }),
            createSettingsButton('Copy template without virgin abuse', () => {
                this.copyTemplate(false);
            }),
        ]);
    }

    private copyTemplate(withVirginAbuse: boolean): void {
        const { templateContext } = this;
        if (!templateContext) {
            this.messenger.showErrorMessage('No template loaded');
            return;
        }

        const { template, detemplatizedImage, detemplatizedImageUint32View } = templateContext;
        const { width: templateWidth, height: templateHeight } = detemplatizedImage;
        const { x: templateX, y: templateY } = template;

        const board = getPxlsUIBoard();
        const boardCtx = board.getContext('2d');
        if (!boardCtx) {
            this.messenger.showErrorMessage('Failed to get board canvas context');
            return;
        }
        const boardImageData = boardCtx.getImageData(templateX, templateY, templateWidth, templateHeight);
        const boardUint32View = new Uint32Array(boardImageData.data.buffer);

        let canvasMask: ImageData | null = null;
        if (!withVirginAbuse) {
            const virginmapBoard = getPxlsUIVirginmapBoard();
            const virginmapCtx = virginmapBoard.getContext('2d');
            if (!virginmapCtx) {
                this.messenger.showErrorMessage('Failed to get virginmap canvas context');
                return;
            }
            canvasMask = virginmapCtx.getImageData(templateX, templateY, templateWidth, templateHeight);
        }

        const correctPixels = new Uint32Array(templateWidth * templateHeight);
        for (let y = 0; y < templateHeight; y++) {
            const rowStart = y * templateWidth;
            for (let x = 0; x < templateWidth; x++) {
                const pixelIndex = rowStart + x;
                const pixelAlphaIndex = pixelIndex * 4 + 3;

                const templateAlpha = detemplatizedImage.data[pixelAlphaIndex];
                if (templateAlpha === 0) {
                    // ignore pixels that aren't in the template
                    continue;
                }

                if (canvasMask) {
                    const maskAlpha = canvasMask.data[pixelAlphaIndex];
                    if (maskAlpha === 0) {
                        // ignore masked pixels
                        continue;
                    }
                }

                const boardColor = boardUint32View[pixelIndex];
                const templateColor = detemplatizedImageUint32View[pixelIndex];

                if (boardColor === templateColor) {
                    correctPixels[pixelIndex] = boardColor;
                }
            }
        }

        const correctPixelsImageData = new ImageData(
            new Uint8ClampedArray(correctPixels.buffer),
            templateWidth,
            templateHeight,
        );
        const tmpCanvas = new OffscreenCanvas(templateWidth, templateHeight);
        const tmpCtx = tmpCanvas.getContext('2d');
        if (!tmpCtx) {
            this.messenger.showErrorMessage('Failed to create temporary canvas context');
            return;
        }
        tmpCtx.putImageData(correctPixelsImageData, 0, 0);

        tmpCanvas
            .convertToBlob({ type: 'image/png' })
            .then(async (blob) => {
                if (!ClipboardItem.supports(blob.type)) {
                    this.messenger.showErrorMessage(`ClipboardItem does not support blob type: ${blob.type}`);
                    return;
                }

                const data = [new ClipboardItem({ [blob.type]: blob })];
                return navigator.clipboard.write(data);
            })
            .then(() => {
                this.messenger.showInfoMessage('Correct pixels copied to clipboard');
            })
            .catch((error: unknown) => {
                if (error instanceof Error) {
                    this.messenger.showErrorMessage(`Failed to convert image data to blob: ${error.message}`, error);
                } else {
                    this.messenger.showErrorMessage(
                        'Failed to convert image data to blob: Unknown error',
                        new Error('Unknown error', { cause: error }),
                    );
                }
            });
    }

    private initEventListeners(): void {
        window.addEventListener(TEMPLATE_CHANGE_EVENT_NAME, ({ detail: template }) => {
            if (template) {
                this.templateChanged(template);
            } else {
                if (this.templateContext) {
                    this.clearTemplate();
                }
            }
        });
    }

    private clearTemplate(): void {
        this.templateContext = null;
    }

    private templateChanged(template: TemplateData): void {
        const width = template.width;

        getTemplateImage()
            .then(async (imageData) => {
                debug('Template image loaded');
                return detemplatizeImage(imageData, width);
            })
            .then((detemplatizedImageData) => {
                debug('Template image detemplatized');
                this.templateContext = {
                    template,
                    detemplatizedImage: detemplatizedImageData,
                    detemplatizedImageUint32View: new Uint32Array(detemplatizedImageData.data.buffer),
                };
            })
            .catch((error: unknown) => {
                if (error instanceof Error) {
                    this.messenger.showErrorMessage(`Failed to load template image: ${error.message}`, error);
                } else {
                    this.messenger.showErrorMessage(
                        'Failed to load template image: Unknown error',
                        new Error('Unknown error', { cause: error }),
                    );
                }
            });
    }

    private async initAfterApp(): Promise<void> {
        this.initSettings();

        await Promise.all([waitForBoardLoaded(), waitForVirginmapLoaded(), waitForHeatmapLoaded()]);

        this.initEventListeners();

        const template = getCurrentTemplate();
        if (template) {
            debug('Template already set, loading');
            this.templateChanged(template);
        }
    }
}
