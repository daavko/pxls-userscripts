import { mdiMapMarkerAlertOutline } from '@mdi/js';
import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug, debugTime } from '../modules/debug';
import { addStylesheet, createDocumentFragment } from '../modules/document';
import { createInfoIcon, InfoIcon, type InfoIconOptions, type InfoIconState } from '../modules/info-icon';
import { showErrorMessage } from '../modules/message';
import { globalInit, waitForApp } from '../modules/pxls-init';
import { getFastLookupPalette } from '../modules/pxls-palette';
import { getCurrentTemplate, TEMPLATE_CHANGE_EVENT_NAME, type TemplateData } from '../modules/pxls-template';
import { getPxlsUIBoard, getPxlsUIBoardContainer, getPxlsUIVirginmapBoard } from '../modules/pxls-ui';
import { createScriptSettings, getGlobalSettings, initGlobalSettings } from '../modules/settings';
import {
    createBooleanSetting,
    createNumberOption,
    createSelectSetting,
    createSettingsResetButton,
    createSettingsUI,
} from '../modules/settings-ui';
import { detemplatizeImageWorker, getTemplateImage } from '../modules/template';
import { bindWebSocketProxy, PIXEL_PLACED_EVENT_NAME, type PlacedPixelData } from '../modules/websocket';
import type { NonNullableKeys } from '../util/types';
import griefTrackerStyles from './grief-tracker.user.css';

globalInit({ scriptId: 'griefTracker', scriptName: 'Grief tracker' });
initGlobalSettings();
debug('Loading grief tracker script');
bindWebSocketProxy();
addStylesheet('dpus__grief-tracker', griefTrackerStyles);

const GRIEF_ANIMATION_STYLES = ['rgbwFlashThick', 'rgbwFlashThin'] as const;
type GriefAnimationStyle = (typeof GRIEF_ANIMATION_STYLES)[number];
const GRIEF_ANIMATION_STYLE_CLASS_MAP: Record<GriefAnimationStyle, string> = {
    rgbwFlashThick: 'dpus__grief-tracker--style-rgbw-flash-thick',
    rgbwFlashThin: 'dpus__grief-tracker--style-rgbw-flash-thin',
};

function stringToAnimationStyle(value: string): GriefAnimationStyle {
    if ((GRIEF_ANIMATION_STYLES as readonly string[]).includes(value)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        return value as GriefAnimationStyle;
    }
    return 'rgbwFlashThin';
}

const GRIEF_ANIMATION_SPEEDS = ['fast', 'slow'] as const;
type GriefAnimationSpeed = (typeof GRIEF_ANIMATION_SPEEDS)[number];
const GRIEF_ANIMATION_SPEED_CLASS_MAP: Record<GriefAnimationSpeed, string> = {
    fast: 'dpus__grief-tracker--speed-fast',
    slow: 'dpus__grief-tracker--speed-slow',
};

const GRIEF_ANIMATION_NAMES = ['dpus__grief-tracker-grief__rgbw-flash'];

function stringToAnimationSpeed(value: string): GriefAnimationSpeed {
    if ((GRIEF_ANIMATION_SPEEDS as readonly string[]).includes(value)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        return value as GriefAnimationSpeed;
    }
    return 'slow';
}

const settingsSchema = v.partial(
    v.object({
        enabled: v.boolean(),
        maxGriefListSize: v.number(),
        animationStyle: v.pipe(
            v.string(),
            v.transform((value) => stringToAnimationStyle(value)),
        ),
        animationSpeed: v.pipe(
            v.string(),
            v.transform((value) => stringToAnimationSpeed(value)),
        ),
    }),
);
type SettingsType = NonNullableKeys<InferOutput<typeof settingsSchema>>;
const defaultSettings: SettingsType = {
    enabled: true,
    maxGriefListSize: 10_000,
    animationStyle: 'rgbwFlashThin',
    animationSpeed: 'slow',
};
const settings = createScriptSettings(settingsSchema, defaultSettings, {
    enabled: [
        (_, newValue): void => {
            griefListContainer.classList.toggle('dpus__grief-tracker--hidden', !newValue);
            if (newValue) {
                if (detemplatizedTemplate) {
                    infoIcon?.setState('templateActive');
                } else {
                    infoIcon?.setState('default');
                }
            } else {
                infoIcon?.setState('disabled');
            }
        },
    ],
    animationStyle: [
        (oldValue, newValue): void => {
            const oldClass = GRIEF_ANIMATION_STYLE_CLASS_MAP[oldValue];
            const newClass = GRIEF_ANIMATION_STYLE_CLASS_MAP[newValue];
            if (oldClass !== newClass) {
                griefListContainer.classList.remove(oldClass);
                griefListContainer.classList.add(newClass);
            }
        },
    ],
    animationSpeed: [
        (oldValue, newValue): void => {
            const oldClass = GRIEF_ANIMATION_SPEED_CLASS_MAP[oldValue];
            const newClass = GRIEF_ANIMATION_SPEED_CLASS_MAP[newValue];
            if (oldClass !== newClass) {
                griefListContainer.classList.remove(oldClass);
                griefListContainer.classList.add(newClass);
            }
        },
    ],
});

let palette: number[] = [];

let virginmapLoadPromise: Promise<void> | null = null;

let detemplatizedTemplate: ImageData | null = null;
let detemplatizedTemplateUint32View: Uint32Array | null = null;

const griefListContainer = createDocumentFragment(`<div class="dpus__grief-tracker"></div>`).children[0];
const griefList = new Map<string, Element>();

const infoIconStates = [
    { key: 'default', color: 'white', title: 'Idle' },
    { key: 'disabled', color: 'gray', title: 'Disabled (click to enable)' },
    { key: 'templateActive', color: 'green', title: 'Template active (click to disable)' },
    { key: 'loadingBoard', color: 'yellow', title: 'Loading board and virginmap' },
    { key: 'loadingTemplate', color: 'orange', title: 'Loading template' },
    { key: 'error', color: 'red' },
] as const satisfies InfoIconState[];
const infoIconOptions: InfoIconOptions<typeof infoIconStates> = {
    clickable: true,
    states: infoIconStates,
};
let infoIcon: InfoIcon<typeof infoIconStates> | null = null;

function initSettings(): void {
    createSettingsUI(() => [
        createBooleanSetting(getGlobalSettings(), 'debug', 'Debug logging'),
        createBooleanSetting(settings, 'enabled', 'Highlight griefs'),
        createNumberOption(settings, 'maxGriefListSize', 'Max grief list size', { min: 1 }),
        createSelectSetting(settings, 'animationStyle', 'Animation style', [
            { value: 'rgbwFlashThick', label: 'RGBW flash (thick)' },
            { value: 'rgbwFlashThin', label: 'RGBW flash (thin)' },
        ]),
        createSelectSetting(settings, 'animationSpeed', 'Animation speed', [
            { value: 'slow', label: 'Slow' },
            { value: 'fast', label: 'Fast' },
        ]),
        createSettingsResetButton(),
    ]);
}

async function waitForVirginmapLoaded(): Promise<void> {
    debug('Waiting for virginmap to load');
    if (!virginmapLoadPromise) {
        const virginmap = getPxlsUIVirginmapBoard();
        virginmapLoadPromise = new Promise((resolve) => {
            const observer = new MutationObserver(() => {
                if (virginmap.getAttribute('width') !== null && virginmap.getAttribute('height') !== null) {
                    observer.disconnect();
                    resolve();
                }
            });
            observer.observe(virginmap, {
                attributes: true,
                attributeFilter: ['width', 'height'],
            });
        });
    }

    return virginmapLoadPromise;
}

async function waitForBoardLoaded(): Promise<void> {
    debug('Waiting for board to load');
    const board = getPxlsUIBoard();
    const ctx = board.getContext('2d');
    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }
    return new Promise((resolve) => {
        const intervalId = setInterval(() => {
            const imageData = ctx.getImageData(0, 0, board.width, board.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
                // find the first non-transparent pixel
                if (imageData.data[i + 3] !== 0) {
                    clearInterval(intervalId);
                    resolve();
                    return;
                }
            }
        }, 1000);
    });
}

function coordToMapKey(x: number, y: number): string {
    return `${x},${y}`;
}

function createGriefHighlightElement(x: number, y: number): HTMLElement {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    return createDocumentFragment(
        `<div class="dpus__grief-tracker-grief" style="--dpus--grief-coord-x: ${x}; --dpus--grief-coord-y: ${y}"></div>`,
    ).children[0] as HTMLElement;
}

function addGriefs(griefs: [number, number][]): void {
    const availableGriefListSize = settings.get('maxGriefListSize') - griefList.size;

    if (availableGriefListSize < griefs.length) {
        showTooManyGriefsMessage();
    }

    const griefsToAdd = Math.min(griefs.length, availableGriefListSize);
    for (let i = 0; i < griefsToAdd; i++) {
        const [x, y] = griefs[i];
        addGriefUnchecked(x, y);
    }
}

function addGrief(x: number, y: number): void {
    if (settings.get('maxGriefListSize') <= griefList.size) {
        showTooManyGriefsMessage();
        return;
    }

    addGriefUnchecked(x, y);
}

function addGriefUnchecked(x: number, y: number): void {
    debug('New grief at', x, y);

    const key = coordToMapKey(x, y);
    if (griefList.has(key)) {
        return;
    }

    const element = createGriefHighlightElement(x, y);
    griefListContainer.appendChild(element);
    element.addEventListener('animationstart', (e) => {
        if (GRIEF_ANIMATION_NAMES.includes(e.animationName)) {
            const animation = element
                .getAnimations()
                .find((a) => a instanceof CSSAnimation && a.animationName === e.animationName);
            if (animation) {
                animation.startTime = 0;
            }
        }
    });
    griefList.set(key, element);
}

function removeGrief(x: number, y: number): void {
    const key = coordToMapKey(x, y);
    const element = griefList.get(key);
    if (element) {
        debug('Removing grief at', x, y);

        griefListContainer.removeChild(element);
        griefList.delete(key);
    }
}

function clearGriefList(): void {
    griefList.clear();
    griefListContainer.textContent = '';
}

function showTooManyGriefsMessage(): void {
    showErrorMessage(`Too many griefs detected. Showing only the first ${settings.get('maxGriefListSize')}.`);
}

function collectExistingGriefs(): void {
    const template = getCurrentTemplate();
    if (!template || !detemplatizedTemplate || !detemplatizedTemplateUint32View) {
        return;
    }

    const board = getPxlsUIBoard();
    const virginmap = getPxlsUIVirginmapBoard();
    const boardCtx = board.getContext('2d');

    if (!boardCtx) {
        throw new Error('Failed to get board canvas context');
    }

    const virginmapCtx = virginmap.getContext('2d');
    if (!virginmapCtx) {
        throw new Error('Failed to get virginmap canvas context');
    }

    const { x: templateX, y: templateY } = template;
    const boardImageData = boardCtx.getImageData(
        templateX,
        templateY,
        detemplatizedTemplate.width,
        detemplatizedTemplate.height,
    );
    const boardImageDataUint32View = new Uint32Array(boardImageData.data.buffer);
    const virginmapImageData = virginmapCtx.getImageData(
        templateX,
        templateY,
        detemplatizedTemplate.width,
        detemplatizedTemplate.height,
    );

    const debugTimer = debugTime('collectExistingGriefs');
    const griefs: [number, number][] = [];
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

            const virginmapAlpha = virginmapImageData.data[pixelAlphaIndex];
            if (virginmapAlpha === 0) {
                // ignore virgin pixels
                continue;
            }

            const boardColor = boardImageDataUint32View[pixelIndex];
            const templateColor = detemplatizedTemplateUint32View[pixelIndex];

            if (boardColor !== templateColor) {
                // placed color is different from template color, this is a grief
                griefs.push([x + templateX, y + templateY]);
            }
        }
    }
    debugTimer?.stop();
    addGriefs(griefs);
}

function pixelPlaced(pixel: PlacedPixelData): void {
    const template = getCurrentTemplate();
    if (!template || !detemplatizedTemplate || !detemplatizedTemplateUint32View) {
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

    if (pixelColor !== placedColor) {
        // placed color is different from template color, this is a grief
        addGrief(pixel.x, pixel.y);
    } else {
        removeGrief(pixel.x, pixel.y);
    }
}

function clearTemplate(): void {
    detemplatizedTemplate = null;
    detemplatizedTemplateUint32View = null;
    clearGriefList();
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
            clearGriefList();
            collectExistingGriefs();
            if (settings.get('enabled')) {
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

async function init(): Promise<void> {
    const app = await waitForApp();
    palette = await getFastLookupPalette();
    infoIcon = createInfoIcon(mdiMapMarkerAlertOutline, infoIconOptions);

    infoIcon.setState('loadingBoard');
    await waitForBoardLoaded();
    app.overlays.virginmap.reload();
    await waitForVirginmapLoaded();
    infoIcon.setState('default');

    debug('Initializing script');

    initSettings();
    const boardContainer = getPxlsUIBoardContainer();
    boardContainer.appendChild(griefListContainer);
    const griefListContainerSpeedClass = GRIEF_ANIMATION_SPEED_CLASS_MAP[settings.get('animationSpeed')];
    griefListContainer.classList.add(griefListContainerSpeedClass);
    const griefListContainerStyleClass = GRIEF_ANIMATION_STYLE_CLASS_MAP[settings.get('animationStyle')];
    griefListContainer.classList.add(griefListContainerStyleClass);
    griefListContainer.classList.toggle('dpus__grief-tracker--hidden', !settings.get('enabled'));

    infoIcon.element.addEventListener('click', () => {
        debug('Info icon clicked');
        settings.set('enabled', !settings.get('enabled'));
    });

    window.addEventListener(PIXEL_PLACED_EVENT_NAME, ({ detail: { pixels } }) => {
        if (!detemplatizedTemplate) {
            return;
        }

        for (const pixel of pixels) {
            pixelPlaced(pixel);
        }
    });

    window.addEventListener(TEMPLATE_CHANGE_EVENT_NAME, ({ detail: template }) => {
        if (template) {
            templateChanged(template);
        } else {
            if (detemplatizedTemplate) {
                clearTemplate();
            }
        }
    });

    const template = getCurrentTemplate();
    if (template) {
        debug('Template already set, loading');
        templateChanged(template);
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
