import { debug, debugTime } from '../modules/debug';
import { addStylesheet } from '../modules/document';
import { el } from '../modules/html';
import { Messenger } from '../modules/message';
import { getFastLookupPalette } from '../modules/pxls-palette';
import { getCurrentTemplate, TEMPLATE_CHANGE_EVENT_NAME, type TemplateData } from '../modules/pxls-template';
import {
    getPxlsUIBoard,
    getPxlsUIMainBubble,
    getPxlsUIVirginmapBoard,
    waitForBoardLoaded,
    waitForVirginmapLoaded,
} from '../modules/pxls-ui';
import { detemplatizeImage, getTemplateImage } from '../modules/template';
import { bindWebSocketProxy, PIXEL_PLACED_EVENT_NAME, type PlacedPixelData } from '../modules/websocket';
import type { PxlsApp } from '../pxls/pxls-global';
import templateInfoStyles from './template-info.user.css';
import { PxlsUserscript } from './userscript';

export class TemplateInfoScript extends PxlsUserscript {
    private readonly messenger = new Messenger('Template info');

    private palette: number[] = [];

    private detemplatizedTemplate: ImageData | null = null;
    private detemplatizedTemplateUint32View: Uint32Array | null = null;

    private boardContext: CanvasRenderingContext2D | null = null;
    private virginmapContext: CanvasRenderingContext2D | null = null;

    private templateTotalPixels = 0;
    private templateCompletedPixels = 0;
    private templateVirginAbusePixels = 0;

    private readonly infoViewElements = {
        totalPixels: el('span', ['0']),
        completedPixels: el('span', ['0']),
        completedPercent: el('span', ['0%']),
        remainingPixels: el('span', ['0']),
        remainingPercent: el('span', ['0%']),
        virginAbusePixels: el('span', ['0']),
        virginAbusePercent: el('span', ['0%']),
    };
    private readonly templateInfoElement = el('div', { class: 'dpus__template-info' }, [
        el('p', ['Template: ', this.infoViewElements.totalPixels]),
        el('p', [
            'Completed: ',
            this.infoViewElements.completedPixels,
            ' (',
            this.infoViewElements.completedPercent,
            ')',
        ]),
        el('p', [
            'Remaining: ',
            this.infoViewElements.remainingPixels,
            ' (',
            this.infoViewElements.remainingPercent,
            ')',
        ]),
        el('p', [
            'Virgin abuse: ',
            this.infoViewElements.virginAbusePixels,
            ' (',
            this.infoViewElements.virginAbusePercent,
            ')',
        ]),
    ]);

    constructor() {
        super(
            'Template Info',
            () => {
                this.initBeforeApp();
            },
            async (app) => this.initAfterApp(app),
        );
    }

    private initUI(): void {
        const bubble = getPxlsUIMainBubble();
        bubble.appendChild(this.templateInfoElement);
    }

    private updateUI(): void {
        const { infoViewElements, templateCompletedPixels, templateTotalPixels, templateVirginAbusePixels } = this;
        const {
            totalPixels,
            completedPixels,
            completedPercent,
            remainingPixels,
            remainingPercent,
            virginAbusePixels,
            virginAbusePercent,
        } = infoViewElements;
        if (this.templateTotalPixels === 0) {
            totalPixels.textContent = '0';
            completedPixels.textContent = '0';
            completedPercent.textContent = '0%';
            remainingPixels.textContent = '0';
            remainingPercent.textContent = '0%';
            virginAbusePixels.textContent = '0';
            virginAbusePercent.textContent = '0%';
            this.templateInfoElement.classList.add('dpus__template-info--hidden');
            return;
        }

        const numberFormatter = new Intl.NumberFormat(undefined, {
            style: 'decimal',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        });
        const percentFormatter = new Intl.NumberFormat(undefined, {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

        const templateCompletedPercent = templateCompletedPixels / templateTotalPixels;
        const templateRemainingPixels = templateTotalPixels - templateCompletedPixels;
        const templateRemainingPercent = templateRemainingPixels / templateTotalPixels;
        const templateVirginAbusePercent = templateVirginAbusePixels / templateTotalPixels;

        totalPixels.textContent = numberFormatter.format(templateTotalPixels) + 'px';
        completedPixels.textContent = numberFormatter.format(templateCompletedPixels) + 'px';
        completedPercent.textContent = percentFormatter.format(templateCompletedPercent);
        remainingPixels.textContent = numberFormatter.format(templateRemainingPixels) + 'px';
        remainingPercent.textContent = percentFormatter.format(templateRemainingPercent);
        virginAbusePixels.textContent = numberFormatter.format(templateVirginAbusePixels) + 'px';
        virginAbusePercent.textContent = percentFormatter.format(templateVirginAbusePercent);
        this.templateInfoElement.classList.remove('dpus__template-info--hidden');
    }

    private collectTemplateInfo(): void {
        const { detemplatizedTemplate, detemplatizedTemplateUint32View, boardContext, virginmapContext } = this;

        const template = getCurrentTemplate();
        if (
            !template ||
            !detemplatizedTemplate ||
            !detemplatizedTemplateUint32View ||
            !boardContext ||
            !virginmapContext
        ) {
            return;
        }

        const { x: templateX, y: templateY } = template;
        const boardImageData = boardContext.getImageData(
            templateX,
            templateY,
            detemplatizedTemplate.width,
            detemplatizedTemplate.height,
        );
        const boardImageDataUint32View = new Uint32Array(boardImageData.data.buffer);
        const virginmapImageData = virginmapContext.getImageData(
            templateX,
            templateY,
            detemplatizedTemplate.width,
            detemplatizedTemplate.height,
        );
        const virginmapImageDataUint32View = new Uint32Array(virginmapImageData.data.buffer);

        const debugTimer = debugTime('collectTemplateInfo');
        this.templateTotalPixels = 0;
        this.templateCompletedPixels = 0;
        this.templateVirginAbusePixels = 0;
        for (let y = 0; y < detemplatizedTemplate.height; y++) {
            const rowStart = y * detemplatizedTemplate.width;
            for (let x = 0; x < detemplatizedTemplate.width; x++) {
                const pixelIndex = rowStart + x;
                const pixelAlphaIndex = pixelIndex * 4 + 3;

                const templateAlpha = detemplatizedTemplate.data[pixelAlphaIndex];
                if (templateAlpha === 0) {
                    // ignore pixels that aren't in the template
                    continue;
                }

                this.templateTotalPixels++;

                const boardColor = boardImageDataUint32View[pixelIndex];
                const templateColor = detemplatizedTemplateUint32View[pixelIndex];

                if (boardColor === templateColor) {
                    // pixel is placed correctly
                    this.templateCompletedPixels++;

                    const virginmapColor = virginmapImageDataUint32View[pixelIndex];
                    if (virginmapColor === 0) {
                        // pixel is virgin
                        this.templateVirginAbusePixels++;
                    }
                }
            }
        }
        debugTimer?.stop();

        this.updateUI();
    }

    private pixelPlaced(pixel: PlacedPixelData): void {
        const { detemplatizedTemplate, detemplatizedTemplateUint32View, virginmapContext, palette } = this;
        const template = getCurrentTemplate();
        if (!template || !detemplatizedTemplate || !detemplatizedTemplateUint32View || !virginmapContext) {
            return;
        }

        const placedColor = palette.at(pixel.color);
        if (placedColor == null) {
            // somehow the color is not in the palette, this should never really happen
            console.error(`Color ${pixel.color} not found in palette`);
            return;
        }

        const pixelTemplateX = pixel.x - template.x;
        const pixelTemplateY = pixel.y - template.y;
        if (
            pixelTemplateX < 0 ||
            pixelTemplateY < 0 ||
            pixelTemplateX >= detemplatizedTemplate.width ||
            pixelTemplateY >= detemplatizedTemplate.height
        ) {
            // out of bounds
            return;
        }

        const pixelIndex = pixelTemplateY * detemplatizedTemplate.width + pixelTemplateX;
        const pixelAlpha = detemplatizedTemplate.data[pixelIndex * 4 + 3];

        if (pixelAlpha === 0) {
            // pixel is transparent
            return;
        }

        const pixelColor = detemplatizedTemplateUint32View[pixelIndex];

        if (pixelColor === placedColor) {
            this.templateCompletedPixels++;

            const virginmapPixelData = virginmapContext.getImageData(pixel.x, pixel.y, 1, 1);
            const virginmapPixelDataColor = new Uint32Array(virginmapPixelData.data.buffer);
            if (virginmapPixelDataColor[0] === 0) {
                // pixel was virgin, deduct from virgin abuse count
                this.templateVirginAbusePixels = Math.max(0, this.templateVirginAbusePixels - 1);
            }
        } else {
            this.templateCompletedPixels--;
        }

        this.updateUI();
    }

    private clearTemplate(): void {
        this.detemplatizedTemplate = null;
        this.detemplatizedTemplateUint32View = null;
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
                this.detemplatizedTemplate = detemplatizedImageData;
                this.detemplatizedTemplateUint32View = new Uint32Array(detemplatizedImageData.data.buffer);
                this.collectTemplateInfo();
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

    private initBeforeApp(): void {
        bindWebSocketProxy();
        addStylesheet('dpus__template-info', templateInfoStyles);
    }

    private async initAfterApp(app: PxlsApp): Promise<void> {
        this.palette = await getFastLookupPalette();

        await waitForBoardLoaded();
        app.overlays.virginmap.reload();
        await waitForVirginmapLoaded();

        debug('Initializing script');

        this.initUI();
        const board = getPxlsUIBoard();
        this.boardContext = board.getContext('2d');
        const virginmap = getPxlsUIVirginmapBoard();
        this.virginmapContext = virginmap.getContext('2d');

        if (!this.boardContext) {
            throw new Error('Failed to get board canvas context');
        }
        if (!this.virginmapContext) {
            throw new Error('Failed to get virginmap canvas context');
        }

        window.addEventListener(PIXEL_PLACED_EVENT_NAME, ({ detail: { pixels } }) => {
            if (!this.detemplatizedTemplate) {
                return;
            }

            for (const pixel of pixels) {
                this.pixelPlaced(pixel);
            }
        });

        window.addEventListener(TEMPLATE_CHANGE_EVENT_NAME, ({ detail: template }) => {
            if (template == null) {
                if (this.detemplatizedTemplate != null) {
                    this.clearTemplate();
                }
            } else {
                this.templateChanged(template);
            }
        });

        const template = getCurrentTemplate();
        if (template) {
            debug('Template already set, loading');
            this.templateChanged(template);
        }
        this.updateUI();
    }
}
