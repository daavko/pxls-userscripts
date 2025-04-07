import { mdiEyedropper } from '@mdi/js';
import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug, setDebugName } from '../modules/debug';
import { createInfoIcon, type InfoIcon, type InfoIconOptions, type InfoIconState } from '../modules/info-icon';
import { setMessagePrefix, showErrorMessage } from '../modules/message';
import { getApp, globalInit, waitForApp } from '../modules/pxls-init';
import { anyColorSelected, getFastLookupPalette, selectColor, unselectColor } from '../modules/pxls-palette';
import { getCurrentTemplate, TEMPLATE_CHANGE_EVENT_NAME, type TemplateData } from '../modules/pxls-template';
import { getPxlsUIBoard, getPxlsUIMouseCoords } from '../modules/pxls-ui';
import {
    booleanSerializer,
    createScriptSettings,
    getGlobalSettings,
    initGlobalSettings,
    type ValueSerializerMap,
} from '../modules/settings';
import {
    createBooleanSetting,
    createKeyboardShortcutText,
    createLineBreak,
    createSettingsResetButton,
    createSettingsText,
    createSettingsUI,
    createSubheading,
} from '../modules/settings-ui';
import { detemplatizeImageWorker, getTemplateImage } from '../modules/template';
import type { NonNullableKeys } from '../util/types';

globalInit();
setDebugName('Template color autoselector');
setMessagePrefix('Template color autoselector');
initGlobalSettings('dpus_templateColorAutoselector_globalSettings');

const settingsSchema = v.partial(
    v.object({
        deselectColorOutsideTemplate: v.boolean(),
        selectColorWhenDeselectedInsideTemplate: v.boolean(),
    }),
);
type SettingsType = NonNullableKeys<InferOutput<typeof settingsSchema>>;
const settingsDefault: SettingsType = {
    deselectColorOutsideTemplate: false,
    selectColorWhenDeselectedInsideTemplate: false,
};
const settingsValueSerializerMap: ValueSerializerMap<SettingsType> = {
    deselectColorOutsideTemplate: booleanSerializer,
    selectColorWhenDeselectedInsideTemplate: booleanSerializer,
};
const settings = createScriptSettings(
    'dpus_templateColorAutoselector_settings',
    settingsSchema,
    settingsDefault,
    settingsValueSerializerMap,
);

// string[] with hex color values
let palette: number[] = [];

let detemplatizedTemplate: ImageData | null = null;
let detemplatizedTemplateUint32View: Uint32Array | null = null;

let currentCoordX: number | null = null;
let currentCoordY: number | null = null;

let pointerDownCoords: { x: number; y: number } | null = null;

let manualToggle = true;
let pointerMoveFuse = false;

const coordsRegex = /^\(([0-9]+), ([0-9]+)\)$/;
let coordsMutationEnabled = false;
const coordsMutationObserver = new MutationObserver(() => {
    processCoords();
});

const infoIconStates = [
    { key: 'default', color: 'white', title: 'Idle' },
    { key: 'disabled', color: 'gray', title: 'Disabled (click to enable)' },
    { key: 'templateActive', color: 'green', title: 'Template active (click to disable)' },
    { key: 'loadingTemplate', color: 'orange', title: 'Loading template' },
    { key: 'error', color: 'red' },
] as const satisfies InfoIconState[];
const infoIconOptions: InfoIconOptions<typeof infoIconStates> = {
    clickable: true,
    states: infoIconStates,
    statesTitlePrefix: '[Template color autoselector]',
};
let infoIcon: InfoIcon<typeof infoIconStates> | null = null;

function initSettings(): void {
    createSettingsUI('Template color autoselector', () => [
        createSubheading('Keybinds'),
        createKeyboardShortcutText('Z', 'Toggle auto-select color'),
        createLineBreak(),
        createSubheading('Settings'),
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
            maybeEnableCoordsMutationObserver();
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
                disableCoordsMutationObserver();
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

            manualToggle = !manualToggle;
            debug('Toggle hotkey pressed');
            if (manualToggle) {
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
    infoIcon = createInfoIcon(mdiEyedropper, infoIconOptions);

    debug('Initializing script');

    initSettings();
    initBoardEventListeners();
    initBodyEventListeners();
    enableCoordsMutationObserver();

    infoIcon.element.addEventListener('click', () => {
        manualToggle = !manualToggle;
        debug('Info icon clicked');
        if (manualToggle) {
            maybeEnableCoordsMutationObserver();
        } else {
            disableCoordsMutationObserver();
        }
    });

    window.addEventListener(TEMPLATE_CHANGE_EVENT_NAME, ({ detail: template }) => {
        if (template == null) {
            if (detemplatizedTemplate != null) {
                clearTemplate();
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
    if (pointerMoveFuse || !manualToggle || !coordsMutationEnabled) {
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

    infoIcon?.setState('default');
}

function templateChanged(template: TemplateData): void {
    const width = template.width;
    infoIcon?.setState('loadingTemplate');

    getTemplateImage()
        .then(async (imageData) => {
            debug('Template image loaded');
            return detemplatizeImageWorker(imageData, width);
        })
        .then((detemplatizedImageData) => {
            debug('Template image detemplatized');
            detemplatizedTemplate = detemplatizedImageData;
            detemplatizedTemplateUint32View = new Uint32Array(detemplatizedImageData.data.buffer);
            if (coordsMutationEnabled) {
                infoIcon?.setState('templateActive');
            } else {
                infoIcon?.setState('disabled');
            }
        })
        .catch((error: Error) => {
            infoIcon?.setState('error');
            showErrorMessage(`Failed to load template image: ${error.message}`, error);
        });
}

function enableCoordsMutationObserver(): void {
    if (coordsMutationEnabled) {
        // already enabled
        return;
    }

    debug('Enabling coords mutation observer');
    coordsMutationObserver.observe(getPxlsUIMouseCoords(), { childList: true });
    coordsMutationEnabled = true;
    if (detemplatizedTemplate != null) {
        infoIcon?.setState('templateActive');
    } else {
        infoIcon?.setState('default');
    }
    processCoords();
}

function disableCoordsMutationObserver(): void {
    if (!coordsMutationEnabled) {
        // already disabled
        return;
    }

    debug('Disabling coords mutation observer');
    coordsMutationObserver.disconnect();
    coordsMutationEnabled = false;
    infoIcon?.setState('disabled');
}

function maybeEnableCoordsMutationObserver(): void {
    if (manualToggle && !pointerMoveFuse) {
        enableCoordsMutationObserver();
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
