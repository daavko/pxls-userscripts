import { z } from 'zod';
import { debug, setDebugName } from '../modules/debug';
import { showErrorMessage, showSuccessMessage } from '../modules/message';
import { getApp, waitForApp } from '../modules/pxls-init';
import { anyColorSelected, getFastLookupPalette, selectColor, unselectColor } from '../modules/pxls-palette';
import { getTemplateWidth, getTemplateX, getTemplateY, watchTemplateWidth } from '../modules/pxls-template';
import { getPxlsUIBoard, getPxlsUIMouseCoords, getPxlsUITemplateImage } from '../modules/pxls-ui';
import { createScriptSettings, getGlobalSettings, initGlobalSettings } from '../modules/settings';
import {
    createBooleanSetting,
    createSettingsResetButton,
    createSettingsText,
    createSettingsUI,
} from '../modules/settings-ui';
import { detemplatizeImageWorker, getTemplateImage, watchTemplateImage } from '../modules/template';

setDebugName('Template color autoselector');
initGlobalSettings('dpus_templateColorAutoselector_globalSettings');

const settingsSchema = z
    .object({
        deselectColorOutsideTemplate: z.boolean(),
        selectColorWhenDeselectedInsideTemplate: z.boolean(),
    })
    .partial();
const settingsDefault: Required<z.infer<typeof settingsSchema>> = {
    deselectColorOutsideTemplate: false,
    selectColorWhenDeselectedInsideTemplate: false,
};
const settings = createScriptSettings('dpus_templateColorAutoselector_settings', settingsSchema, settingsDefault);

// string[] with hex color values
let palette: number[] = [];

let detemplatizedTemplate: ImageData | null = null;
let detemplatizedTemplateUint32View: Uint32Array | null = null;

let currentCoordX: number | null = null;
let currentCoordY: number | null = null;

let pointerDownCoords: { x: number; y: number } | null = null;

let hotkeyToggle = true;
let pointerMoveFuse = false;

const coordsRegex = /^\(([0-9]+), ([0-9]+)\)$/;
let coordsMutationEnabled = false;
const coordsMutationObserver = new MutationObserver(() => {
    processCoords();
});

function initSettings(): void {
    createSettingsUI('Template color autoselector', () => [
        createBooleanSetting(getGlobalSettings(), 'debug', 'Debug logging'),
        createBooleanSetting(settings, 'deselectColorOutsideTemplate', 'Deselect color outside template'),
        createBooleanSetting(
            settings,
            'selectColorWhenDeselectedInsideTemplate',
            'Select color when deselected inside template',
        ),
        createSettingsResetButton(),
        createSettingsText(
            'Changes are applied immediately. If you have multiple tabs open, you will need to reload the other tabs when you change an option. Resetting options requires you to reload all open Pxls tabs.',
        ),
    ]);
}

function initBoardEventListeners(): void {
    const board = getPxlsUIBoard();
    board.addEventListener(
        'pointerdown',
        (event) => {
            pointerDownCoords = { x: event.clientX, y: event.clientY };
            pointerMoveFuse = false;
            debug(`Pointer down at ${pointerDownCoords.x}, ${pointerDownCoords.y}`);
        },
        { passive: true },
    );
    board.addEventListener(
        'pointerup',
        () => {
            debug('Pointer up');
            pointerDownCoords = null;
            pointerMoveFuse = false;
            maybeEnableCoordsMutationObserver(true);
        },
        { passive: true },
    );
    board.addEventListener(
        'pointermove',
        (event) => {
            if (pointerDownCoords === null || pointerMoveFuse) {
                return;
            }

            const coords = { x: event.clientX, y: event.clientY };
            const distance = Math.sqrt((coords.x - pointerDownCoords.x) ** 2 + (coords.y - pointerDownCoords.y) ** 2);
            if (distance > 5) {
                debug(`Pointer move fuse triggered at ${coords.x},${coords.y} distance ${distance}`);
                pointerMoveFuse = true;
                disableCoordsMutationObserver(true);
            }
        },
        { passive: true },
    );
}

function initBodyEventListeners(): void {
    document.body.addEventListener('keydown', (event) => {
        if (event.key === 'z') {
            if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
                return;
            }

            hotkeyToggle = !hotkeyToggle;
            debug(`Hotkey toggle: ${hotkeyToggle}`);
            if (hotkeyToggle) {
                maybeEnableCoordsMutationObserver();
            } else {
                disableCoordsMutationObserver();
            }
        }
    });
}

async function init(): Promise<void> {
    debug('Initializing');

    initSettings();

    try {
        palette = await getFastLookupPalette();

        debug('Observing coords element for changes');
        enableCoordsMutationObserver(true);

        initBoardEventListeners();
        initBodyEventListeners();

        watchTemplateWidth(() => {
            debug('Template width changed');
            templateParamChanged();
        }, false);

        watchTemplateImage((_, currentSrc) => {
            if (currentSrc !== '') {
                debug('Template image changed');
                templateParamChanged();
            }
        }, false);

        const templateWidth = getTemplateWidth();
        const templateImageElement = getPxlsUITemplateImage();
        if (templateImageElement.src !== '' && templateWidth != null && templateWidth > 0) {
            debug('Template image already set, loading');
            templateParamChanged();
        }
    } catch (e: unknown) {
        if (e instanceof Error) {
            showErrorMessage(e.message);
            return;
        }
        showErrorMessage('Error in init: ' + String(e));
    }
}

function processCoords(): void {
    if (pointerMoveFuse || !hotkeyToggle) {
        // disabled via any internal mechanism
        return;
    }

    const templateX = getTemplateX();
    const templateY = getTemplateY();
    if (detemplatizedTemplate == null || templateX == null || templateY == null) {
        // no template = nothing to do
        return;
    }

    if (!getApp().user.isLoggedIn()) {
        // not logged in, can't place so don't touch
        return;
    }

    const coordsText = getPxlsUIMouseCoords().textContent?.trim();
    if (coordsText == null || coordsText === '') {
        // empty is fine
        return;
    }

    const match = coordsRegex.exec(coordsText);
    if (!match) {
        showErrorMessage('Failed to parse coords text');
        return;
    }

    const x = parseInt(match[1]);
    const y = parseInt(match[2]);

    if (x === currentCoordX && y === currentCoordY) {
        // no change
        return;
    }

    currentCoordX = x;
    currentCoordY = y;

    coordsChanged(x - templateX, y - templateY);
}

function coordsChanged(x: number, y: number): void {
    if (detemplatizedTemplate == null || detemplatizedTemplateUint32View == null) {
        // no template = nothing to do
        return;
    }

    if (x < 0 || y < 0 || x >= detemplatizedTemplate.width || y >= detemplatizedTemplate.height) {
        // out of bounds

        if (settings.get('deselectColorOutsideTemplate')) {
            unselectColor();
        }
        return;
    }

    const i = y * detemplatizedTemplate.width + x;
    const pixelAlpha = detemplatizedTemplate.data[i * 4 + 3];

    if (pixelAlpha === 0) {
        // transparent, so out of template

        if (settings.get('deselectColorOutsideTemplate')) {
            unselectColor();
        }
        return;
    }

    const pixel = detemplatizedTemplateUint32View[i];
    const paletteColorIndex = palette.indexOf(pixel);
    if (paletteColorIndex === -1) {
        // no color, don't touch
        return;
    }

    if (settings.get('selectColorWhenDeselectedInsideTemplate')) {
        selectColor(paletteColorIndex);
    } else {
        if (anyColorSelected()) {
            selectColor(paletteColorIndex);
        }
    }
}

function templateParamChanged(): void {
    const width = getTemplateWidth();
    const x = getTemplateX();
    const y = getTemplateY();
    const templateImageElement = getPxlsUITemplateImage();

    if (templateImageElement.src === '' || width == null || width === 0) {
        // no template, clear detemplatizedTemplate
        debug('No template, clearing detemplatized template');
        detemplatizedTemplate = null;
        detemplatizedTemplateUint32View = null;
        return;
    }

    if (width < 0 || Number.isNaN(width)) {
        showErrorMessage('Invalid template width');
        return;
    }

    if (x == null || x < 0 || y == null || y < 0) {
        showErrorMessage('Invalid template coords');
        return;
    }

    getTemplateImage()
        .then(async (imageData) => {
            debug('Template image loaded');
            return detemplatizeImageWorker(imageData, width);
        })
        .then((detemplatizedImageData) => {
            debug('Template image detemplatized');
            detemplatizedTemplate = detemplatizedImageData;
            detemplatizedTemplateUint32View = new Uint32Array(detemplatizedImageData.data.buffer);
            showSuccessMessage('AutoColorSelector template loaded');
        })
        .catch((error: Error) => {
            showErrorMessage(error.message);
        });
}

function enableCoordsMutationObserver(silent = false): void {
    if (coordsMutationEnabled) {
        // already enabled
        return;
    }

    debug('Enabling coords mutation observer');
    coordsMutationObserver.observe(getPxlsUIMouseCoords(), { childList: true });
    coordsMutationEnabled = true;
    processCoords();
    if (!silent) {
        showSuccessMessage('AutoColorSelector enabled', 1000);
    }
}

function disableCoordsMutationObserver(silent = false): void {
    if (!coordsMutationEnabled) {
        // already disabled
        return;
    }

    debug('Disabling coords mutation observer');
    coordsMutationObserver.disconnect();
    coordsMutationEnabled = false;
    if (!silent) {
        showSuccessMessage('AutoColorSelector disabled', 1000);
    }
}

function maybeEnableCoordsMutationObserver(silent = false): void {
    if (hotkeyToggle && !pointerMoveFuse) {
        enableCoordsMutationObserver(silent);
    }
}

debug('Starting Template color autoselector script');
waitForApp()
    .then(async () => {
        debug('PxlS initialized, starting script');
        return init();
    })
    .catch((e: Error) => {
        console.error(e);
        showErrorMessage(`Failed to initialize: ${e.message}`);
    });
