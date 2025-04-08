import { z } from 'zod';
import { debug, setDebugName } from '../modules/debug';
import { setMessagePrefix, showErrorMessage, showSuccessMessage } from '../modules/message';
import { getApp, waitForApp } from '../modules/pxls-init';
import { anyColorSelected, getFastLookupPalette, selectColor, unselectColor } from '../modules/pxls-palette';
import { getCurrentTemplate, TEMPLATE_CHANGE_EVENT_NAME, type TemplateData } from '../modules/pxls-template';
import { getPxlsUIBoard, getPxlsUIMouseCoords } from '../modules/pxls-ui';
import { createScriptSettings, getGlobalSettings, initGlobalSettings } from '../modules/settings';
import {
    createBooleanSetting,
    createSettingsResetButton,
    createSettingsText,
    createSettingsUI,
} from '../modules/settings-ui';
import { detemplatizeImageWorker, getTemplateImage } from '../modules/template';

setDebugName('Template color autoselector');
setMessagePrefix('Template color autoselector');
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
        ({ clientX, clientY }) => {
            pointerDownCoords = { x: clientX, y: clientY };
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
        ({ clientX, clientY }) => {
            if (pointerDownCoords === null || pointerMoveFuse) {
                return;
            }

            const coords = { x: clientX, y: clientY };
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
    await waitForApp();
    palette = await getFastLookupPalette();

    debug('Initializing script');

    initSettings();
    initBoardEventListeners();
    initBodyEventListeners();
    enableCoordsMutationObserver(true);

    window.addEventListener(TEMPLATE_CHANGE_EVENT_NAME, ({ detail: template }) => {
        if (template == null) {
            if (detemplatizedTemplate != null) {
                clearTemplate();
                showSuccessMessage('Template cleared');
            }
        } else {
            templateChanged(template);
        }
    });

    const template = getCurrentTemplate();
    if (template) {
        debug('Template already set, loading');
        templateChanged(template);
    }
}

function processCoords(): void {
    if (pointerMoveFuse || !hotkeyToggle) {
        // disabled via any internal mechanism
        return;
    }

    const template = getCurrentTemplate();
    if (detemplatizedTemplate == null || template?.x == null || template?.y == null) {
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

    coordsChanged(x - template.x, y - template.y);
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

function clearTemplate(): void {
    detemplatizedTemplate = null;
    detemplatizedTemplateUint32View = null;
}

function templateChanged(template: TemplateData): void {
    const width = template.width;

    getTemplateImage()
        .then(async (imageData) => {
            debug('Template image loaded');
            return detemplatizeImageWorker(imageData, width);
        })
        .then((detemplatizedImageData) => {
            debug('Template image detemplatized');
            detemplatizedTemplate = detemplatizedImageData;
            detemplatizedTemplateUint32View = new Uint32Array(detemplatizedImageData.data.buffer);
            showSuccessMessage('Template loaded');
        })
        .catch((error: Error) => {
            showErrorMessage(`Failed to load template image: ${error.message}`, error);
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
        showSuccessMessage('Enabled', 1000);
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
        showSuccessMessage('Disabled', 1000);
    }
}

function maybeEnableCoordsMutationObserver(silent = false): void {
    if (hotkeyToggle && !pointerMoveFuse) {
        enableCoordsMutationObserver(silent);
    }
}

init().catch((e: unknown) => {
    if (e instanceof Error) {
        showErrorMessage(`Error during initialization: ${e.message}`, e);
        return;
    } else {
        showErrorMessage('Unknown error during initialization', new Error('Unknown error', { cause: e }));
    }
});
