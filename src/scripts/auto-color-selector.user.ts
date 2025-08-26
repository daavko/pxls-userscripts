import { mdiEyedropper } from '@mdi/js';
import { Random } from 'random';
import { debug } from '../modules/debug';
import { createInfoIcon } from '../modules/info-icon';
import { getApp } from '../modules/pxls-init';
import { anyColorSelected, getFastLookupPalette, selectColor, unselectColor } from '../modules/pxls-palette';
import { getCurrentTemplate, TEMPLATE_CHANGE_EVENT_NAME, type TemplateData } from '../modules/pxls-template';
import { getPxlsUIBoard, getPxlsUIMouseCoords } from '../modules/pxls-ui';
import { BooleanSetting, Settings, StringSetting } from '../modules/settings';
import {
    createBooleanSetting,
    createKeyboardShortcutText,
    createLineBreak,
    createSettingsButton,
    createSettingsResetButton,
    createSettingsUI,
    createStringSetting,
    createSubheading,
} from '../modules/settings-ui';
import { detemplatizeImage, getTemplateImage } from '../modules/template';
import { instanceUsesAllowlists, isUserInList } from '../modules/userlist';
import type { PxlsApp } from '../pxls/pxls-global';
import { eventTargetIsTextInput } from '../util/event';
import { pointsDistance } from '../util/geometry';
import { PxlsUserscript } from './userscript';

const COORDS_REGEX = /^\(([0-9]+), ([0-9]+)\)$/;

function randomGriefSeed(): string {
    return window.crypto.randomUUID().replaceAll('-', '');
}

export class AutoColorSelectorScript extends PxlsUserscript {
    private readonly settings = Settings.create('templateColorAutoselector', {
        deselectColorOutsideTemplate: new BooleanSetting(false),
        selectColorWhenDeselectedInsideTemplate: new BooleanSetting(false),
        griefMode: new BooleanSetting(false),
        griefSeed: new StringSetting(randomGriefSeed()),
    });

    private palette: number[] = [];

    private detemplatizedTemplate: ImageData | null = null;
    private detemplatizedTemplateUint32View: Uint32Array | null = null;

    private currentCoordX: number | null = null;
    private currentCoordY: number | null = null;

    private pointerDownCoords: { x: number; y: number } | null = null;

    private manualToggle = true;
    private pointerMoveFuse = false;

    private coordsMutationEnabled = false;
    private readonly coordsMutationObserver = new MutationObserver(() => {
        this.processCoords();
    });

    private readonly infoIcon = createInfoIcon('Template color autoselector', mdiEyedropper, {
        clickable: true,
        states: [
            { key: 'default', color: 'white', title: 'Idle' },
            { key: 'disabled', color: 'gray', title: 'Disabled (click to enable)' },
            { key: 'templateActive', color: 'green', title: 'Template active (click to disable)' },
            { key: 'loadingTemplate', color: 'orange', title: 'Loading template' },
            { key: 'error', color: 'red' },
        ],
    });

    private userAllowedToGrief = false;

    constructor() {
        super('Template Color Autoselector', undefined, async (app) => this.initAfterApp(app));
    }

    private async initAfterApp(app: PxlsApp): Promise<void> {
        this.palette = await getFastLookupPalette();

        if (await instanceUsesAllowlists()) {
            try {
                this.userAllowedToGrief = await isUserInList(
                    app.user.getUsername(),
                    'https://pxls.daavko.moe/userscripts/auto-color-selector-grief-whitelist.json',
                );
            } catch (e) {
                debug('Failed to check if user is allowed to grief:', e);
                this.userAllowedToGrief = false;
            }
        } else {
            // let people do whatever they want
            this.userAllowedToGrief = true;
        }

        this.infoIcon.addToIconsContainer();
        this.initSettings();
        this.initBoardEventListeners();
        this.initBodyEventListeners();
        this.enableCoordsMutationObserver();

        this.infoIcon.element.addEventListener('click', (e) => {
            if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
                return;
            }

            if (e.button !== 0) {
                return;
            }

            this.manualToggle = !this.manualToggle;
            if (this.manualToggle) {
                this.maybeEnableCoordsMutationObserver();
            } else {
                this.disableCoordsMutationObserver();
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
    }

    private initSettings(): void {
        let griefSettingsUi: HTMLElement[] = [];
        if (this.userAllowedToGrief) {
            griefSettingsUi = [
                createBooleanSetting(this.settings.griefMode, 'Enable grief mode'),
                createStringSetting(this.settings.griefSeed, 'Grief seed'),
                createSettingsButton('Random seed', () => {
                    this.settings.griefSeed.set(randomGriefSeed());
                }),
            ];
        }

        createSettingsUI('templateColorAutoselector', 'DPUS Template Color Autoselector', () => [
            createSubheading('Keybinds'),
            createKeyboardShortcutText('Z', 'Toggle auto-select color'),
            createLineBreak(),
            createSubheading('Settings'),
            createBooleanSetting(this.settings.deselectColorOutsideTemplate, 'Deselect color outside template'),
            createBooleanSetting(
                this.settings.selectColorWhenDeselectedInsideTemplate,
                'Select color when deselected inside template',
            ),
            ...griefSettingsUi,
            createSettingsResetButton(this.settings),
        ]);
    }

    private initBoardEventListeners(): void {
        const board = getPxlsUIBoard();
        board.addEventListener(
            'pointerdown',
            ({ clientX, clientY }) => {
                this.pointerDownCoords = { x: clientX, y: clientY };
                this.pointerMoveFuse = false;
                debug(`Pointer down at ${this.pointerDownCoords.x}, ${this.pointerDownCoords.y}`);
            },
            { passive: true },
        );
        board.addEventListener(
            'pointerup',
            () => {
                debug('Pointer up');
                this.pointerDownCoords = null;
                this.pointerMoveFuse = false;
                this.maybeEnableCoordsMutationObserver();
            },
            { passive: true },
        );
        board.addEventListener(
            'pointermove',
            ({ clientX, clientY }) => {
                if (this.pointerDownCoords === null || this.pointerMoveFuse) {
                    return;
                }

                const coords = { x: clientX, y: clientY };
                const distance = pointsDistance(coords.x, coords.y, this.pointerDownCoords.x, this.pointerDownCoords.y);
                if (distance > 5) {
                    debug(`Pointer move fuse triggered at ${coords.x},${coords.y} distance ${distance}`);
                    this.pointerMoveFuse = true;
                    this.disableCoordsMutationObserver();
                }
            },
            { passive: true },
        );
    }

    private initBodyEventListeners(): void {
        document.body.addEventListener('keydown', (event) => {
            if (eventTargetIsTextInput(event)) {
                return;
            }

            if (event.key === 'z') {
                if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
                    return;
                }

                this.manualToggle = !this.manualToggle;
                debug('Toggle hotkey pressed');
                if (this.manualToggle) {
                    this.maybeEnableCoordsMutationObserver();
                } else {
                    this.disableCoordsMutationObserver();
                }
            }
        });
    }

    private processCoords(): void {
        if (this.pointerMoveFuse || !this.manualToggle || !this.coordsMutationEnabled) {
            // disabled via any internal mechanism
            return;
        }

        const template = getCurrentTemplate();
        if (this.detemplatizedTemplate == null || template == null) {
            // no template = nothing to do
            return;
        }

        if (!getApp().user.isLoggedIn()) {
            // not logged in, can't place so don't touch
            return;
        }

        const coordsText = getPxlsUIMouseCoords().textContent.trim();
        if (coordsText === '') {
            // empty is fine
            return;
        }

        const match = COORDS_REGEX.exec(coordsText);
        if (!match) {
            this.messenger.showErrorMessage('Failed to parse coords text');
            return;
        }

        const x = parseInt(match[1]);
        const y = parseInt(match[2]);

        if (x === this.currentCoordX && y === this.currentCoordY) {
            // no change
            return;
        }

        this.currentCoordX = x;
        this.currentCoordY = y;

        this.coordsChanged(x - template.x, y - template.y);
    }

    private coordsChanged(x: number, y: number): void {
        if (this.detemplatizedTemplate == null || this.detemplatizedTemplateUint32View == null) {
            // no template = nothing to do
            return;
        }

        if (x < 0 || y < 0 || x >= this.detemplatizedTemplate.width || y >= this.detemplatizedTemplate.height) {
            // out of bounds

            if (this.settings.deselectColorOutsideTemplate.get()) {
                unselectColor();
            }
            return;
        }

        const i = y * this.detemplatizedTemplate.width + x;
        const pixelAlpha = this.detemplatizedTemplate.data[i * 4 + 3];

        if (pixelAlpha === 0) {
            // transparent, so out of template

            if (this.settings.deselectColorOutsideTemplate.get()) {
                unselectColor();
            }
            return;
        }

        const pixel = this.detemplatizedTemplateUint32View[i];
        const paletteColorIndex = this.palette.indexOf(pixel);
        if (paletteColorIndex === -1) {
            // no color, don't touch
            return;
        }

        if (this.userAllowedToGrief && this.settings.griefMode.get() && this.settings.griefSeed.get() !== '') {
            // only colors that are *not* in the template
            const griefColorIndexes = this.palette
                .map((_color, index) => index)
                .filter((index) => index !== paletteColorIndex);
            const rand = new Random(`${this.settings.griefSeed.get()}${x}${y}`);
            const randIndex = rand.int(0, griefColorIndexes.length - 1);
            selectColor(griefColorIndexes[randIndex]);
        } else {
            if (this.settings.selectColorWhenDeselectedInsideTemplate.get()) {
                selectColor(paletteColorIndex);
            } else {
                if (anyColorSelected()) {
                    selectColor(paletteColorIndex);
                }
            }
        }
    }

    private clearTemplate(): void {
        this.detemplatizedTemplate = null;
        this.detemplatizedTemplateUint32View = null;

        this.infoIcon.setState('default');
    }

    private templateChanged(template: TemplateData): void {
        const width = template.width;
        this.infoIcon.setState('loadingTemplate');

        getTemplateImage()
            .then(async (imageData) => {
                debug('Template image loaded');
                return detemplatizeImage(imageData, width);
            })
            .then((detemplatizedImageData) => {
                debug('Template image detemplatized');
                this.detemplatizedTemplate = detemplatizedImageData;
                this.detemplatizedTemplateUint32View = new Uint32Array(detemplatizedImageData.data.buffer);
                if (this.coordsMutationEnabled) {
                    this.infoIcon.setState('templateActive');
                } else {
                    this.infoIcon.setState('disabled');
                }
            })
            .catch((error: unknown) => {
                this.infoIcon.setState('error');
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

    private enableCoordsMutationObserver(): void {
        if (this.coordsMutationEnabled) {
            return;
        }

        debug('Enabling coords mutation observer');
        this.coordsMutationObserver.observe(getPxlsUIMouseCoords(), { childList: true });
        this.coordsMutationEnabled = true;
        if (this.detemplatizedTemplate != null) {
            this.infoIcon.setState('templateActive');
        } else {
            this.infoIcon.setState('default');
        }
        this.processCoords();
    }

    private disableCoordsMutationObserver(): void {
        if (!this.coordsMutationEnabled) {
            return;
        }

        debug('Disabling coords mutation observer');
        this.coordsMutationObserver.disconnect();
        this.coordsMutationEnabled = false;
        this.infoIcon.setState('disabled');
    }

    private maybeEnableCoordsMutationObserver(): void {
        if (this.manualToggle && !this.pointerMoveFuse) {
            this.enableCoordsMutationObserver();
        }
    }
}
