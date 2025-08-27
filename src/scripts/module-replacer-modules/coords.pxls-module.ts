import type { PxlsBoardModule, PxlsCoordsModule, PxlsQueryModule } from '../../pxls/pxls-modules';
import type { PxlsExtendedBoardModule } from '../../pxls/pxls-modules-ext';
import { eventTargetIsTextInput } from '../../util/event';
import type { Point } from '../../util/geometry';
import type { ModuleExport, ModuleImportFunction } from './types';
import { DEFAULT_BROKEN_SCRIPT } from './util';

declare const requireFn: ModuleImportFunction;
declare const moduleExport: ModuleExport<'coords'>;

let board: PxlsBoardModule | null = null;
let boardExt: PxlsExtendedBoardModule | null = null;
let query: PxlsQueryModule | null = null;

const coords = {
    coordsWrapper: $('#coords-info'),
    coords: $('#coords-info .coords'),
    lockIcon: $('#canvas-lock-icon'),

    lastKnownCoords: null as Point | null,

    init: (): void => {
        const boardModule = requireFn('./board');
        board = boardModule.board;
        boardExt = boardModule.boardExt;
        query = requireFn('./query').query;

        coords.coordsWrapper.hide();

        const boardCanvas = boardExt.boardCanvas;
        boardCanvas.addEventListener('pointermove', (e) => {
            coords.updateCoordsElement(e);
        });
        boardCanvas.addEventListener('pointerdown', (e) => {
            coords.updateCoordsElement(e);
        });

        document.body.addEventListener('keydown', (e) => {
            if (eventTargetIsTextInput(e)) {
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                return;
            }

            if (e.key === 'c') {
                coords.copyCoords();
            }
        });
    },
    copyCoords: (useHash = false): void => {
        if (!window.isSecureContext || !coords.lastKnownCoords) {
            return;
        }

        let linkToCoords: string;
        if (useHash) {
            const x = query?.get('x');
            const y = query?.get('y');
            const scale = query?.get('scale');
            linkToCoords = coords.getLinkToStringCoords(x, y, scale);
        } else {
            const { x, y } = coords.lastKnownCoords;
            linkToCoords = coords.getLinkToCoords(x, y, 20);
        }

        navigator.clipboard.writeText(linkToCoords).catch((e: unknown) => {
            console.error('Failed to copy coords to clipboard:', e);
        });
        coords.coordsWrapper.addClass('copyPulse');
        setTimeout(() => {
            coords.coordsWrapper.removeClass('copyPulse');
        }, 200);
    },
    getLinkTemplateConfig: (): string => {
        return ['template', 'tw', 'ox', 'oy', 'title', 'convert']
            .map((conf) => query?.get(conf))
            .filter((val) => val != null)
            .map((conf) => `${conf}=${encodeURIComponent(conf)}`)
            .join('&');
    },
    getLinkToStringCoords: (x = '0', y = '0', scale = '20'): string => {
        return `${location.origin}/#x=${x}&y=${y}&scale=${scale}&${coords.getLinkTemplateConfig()}`;
    },
    getLinkToCoords: (x = 0, y = 0, scale = 20): string => {
        return coords.getLinkToStringCoords(Math.floor(x).toString(), Math.floor(y).toString(), scale.toString());
    },
    updateCoordsElement: (e: PointerEvent): void => {
        const { offsetX, offsetY } = e;
        if (!(boardExt?.screenSpaceCoordIsOnBoard(offsetX, offsetY) ?? false)) {
            return;
        }

        const boardPos = board?.fromScreen(e.offsetX, e.offsetY);

        if (!boardPos) {
            return;
        }

        coords.lastKnownCoords = boardPos;
        coords.coords.text(`(${boardPos.x}, ${boardPos.y})`);
        if (!coords.coordsWrapper.is(':visible')) {
            coords.coordsWrapper.fadeIn(200);
        }
    },
};

const coordsExport: PxlsCoordsModule = {
    init: (): void => {
        coords.init();
    },
    copyCoords: (useHash?: boolean): void => {
        coords.copyCoords(useHash);
    },
    getLinkToCoords: (x?: number, y?: number, scale?: number): string => {
        return coords.getLinkToCoords(x, y, scale);
    },
    lockIcon: coords.lockIcon,
};
moduleExport.exports.coords = coordsExport;

export default DEFAULT_BROKEN_SCRIPT;
