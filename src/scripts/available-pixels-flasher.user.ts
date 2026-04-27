import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { addStylesheet } from '../modules/document';
import { el } from '../modules/html';
import { Messenger } from '../modules/message';
import { getPxlsUICooldownTimer, getPxlsUIPlaceableCount } from '../modules/pxls-ui';
import { BooleanSetting, SettingBase, Settings, type SettingUpdateCallback } from '../modules/settings';
import { createBooleanSetting, createLineBreak, createSettingsUI, createStringSetting } from '../modules/settings-ui';
import availablePixelsFlasherStyles from './available-pixels-flasher.user.css';
import { PxlsUserscript } from './userscript';

const flashKeyframeSchema = v.tuple([
    v.pipe(v.string(), v.regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/)),
    v.pipe(v.number(), v.safeInteger(), v.minValue(1)),
]);

const flashKeyframesSchema = v.pipe(
    v.string(),
    v.trim(),
    v.transform((input) => input.split(' ')),
    v.minLength(1),
    v.transform((input) => {
        return input.map((frame) => frame.split(','));
    }),
    v.everyItem((item) => item.length === 2),
    v.mapItems(([color, time]) => {
        return [color, Number.parseInt(time, 10)] as const;
    }),
    v.array(flashKeyframeSchema),
);
type FlashKeyframes = InferOutput<typeof flashKeyframesSchema>;

class FlashKeyframesSetting extends SettingBase<FlashKeyframes, string> {
    constructor(defaultValue: FlashKeyframes, valueUpdateCallbacks: SettingUpdateCallback<FlashKeyframes>[] = []) {
        super(defaultValue, flashKeyframesSchema, valueUpdateCallbacks);
    }

    override serializeValue(value: FlashKeyframes): string {
        return value.map(([color, time]) => `${color},${time}`).join(' ');
    }

    override valuesEqual(value1: FlashKeyframes, value2: FlashKeyframes): boolean {
        if (value1.length !== value2.length) {
            return false;
        }

        for (let i = 0; i < value1.length; i++) {
            const [color1, time1] = value1[i];
            const [color2, time2] = value2[i];
            if (color1 !== color2 || time1 !== time2) {
                return false;
            }
        }

        return true;
    }
}

export class AvailablePixelsFlasherScript extends PxlsUserscript {
    private readonly messenger = new Messenger('Available pixels flasher');

    private readonly settings = Settings.create('flashOnAvailablePixels', {
        flashEnabled: new BooleanSetting(true),
        syncToCooldownOffset: new BooleanSetting(true),
        flashKeyframes: new FlashKeyframesSetting([
            ['#FFFFFF', 250],
            ['#000000', 250],
            ['#FFFFFF', 250],
            ['#000000', 250],
        ]),
        flashOnStackGain: new BooleanSetting(true),
    });

    private readonly flashOverlay = el('div', {
        class: ['dpus__stack-flasher', 'dpus__stack-flasher--hidden'],
    });
    private runningAnimation?: Animation;

    private lastKnownStackCount?: number;
    private lastKnownCooldownOffset = 0;
    private readonly stackCountObserver = new MutationObserver(() => {
        this.processStackCountChanges();
    });
    private readonly cooldownObserver = new MutationObserver(() => {
        this.processCooldownChanges();
    });

    constructor() {
        super(
            'Available Pixels Flasher',
            () => {
                addStylesheet('dpus__available-pixels-flasher', availablePixelsFlasherStyles);
            },
            (app) => {
                this.initSettings();
                this.initEventListeners();
                document.body.appendChild(this.flashOverlay);
                this.processStackCountChanges();

                const stackCountElement = getPxlsUIPlaceableCount();
                this.stackCountObserver.observe(stackCountElement, {
                    childList: true,
                    characterData: true,
                });

                const cooldownTimerElement = getPxlsUICooldownTimer();
                this.cooldownObserver.observe(cooldownTimerElement, {
                    childList: true,
                    characterData: true,
                });

                app.settings.place.alert.delay.listen((value) => {
                    // just pxls things
                    const valueNumber = Number.parseInt(value.toString(), 10);
                    if (Number.isNaN(valueNumber)) {
                        return;
                    }
                    this.lastKnownCooldownOffset = Math.min(valueNumber, 0);
                });
            },
        );
    }

    private initSettings(): void {
        const { settings } = this;
        createSettingsUI('flashOnAvailablePixels', 'Flash on available pixels', () => [
            createBooleanSetting(settings.flashEnabled, 'Enable flash on new available pixels'),
            createBooleanSetting(settings.syncToCooldownOffset, 'Sync flash to audio notification'),
            el('p', [
                'When enabled, this will cause the flash to trigger when the cooldown timer reaches the offset set in "Alert delay" in the main settings.',
            ]),
            createBooleanSetting(settings.flashOnStackGain, 'Flash when stack increases above 1'),
            createLineBreak(),
            createStringSetting(settings.flashKeyframes, 'Flash keyframes'),
            el('p', ['Format: ', el('code', ['#RRGGBB,duration_ms ...']), ' (space separated)']),
            el('p', ['Example: ', el('code', ['#FFFFFF,500 #000000,500'])]),
            el('p', ['Format with opacity: ', el('code', ['#RRGGBBAA,duration_ms ...'])]),
            el('p', ['Example (50% opacity): ', el('code', ['#FFFFFF7F,500 #0000007F,500'])]),
        ]);
    }

    private initEventListeners(): void {
        window.addEventListener('pointermove', () => {
            this.stopFlash();
        });
        window.addEventListener('pointerdown', () => {
            this.stopFlash();
        });
    }

    private processStackCountChanges(): void {
        const stackCountElement = getPxlsUIPlaceableCount();
        const stackCountText = stackCountElement.textContent;

        const pixelCount = stackCountText.split('/').at(0);
        if (pixelCount == null) {
            return;
        }

        const stackCount = Number.parseInt(pixelCount, 10);
        if (Number.isNaN(stackCount)) {
            return;
        }

        if (this.lastKnownStackCount === undefined) {
            this.lastKnownStackCount = stackCount;
            return;
        }

        if (stackCount > this.lastKnownStackCount) {
            if (stackCount === 1 && (this.lastKnownCooldownOffset === 0 || !this.settings.syncToCooldownOffset.get())) {
                this.runFlash();
            } else if (stackCount > 1 && this.settings.flashOnStackGain.get()) {
                this.runFlash();
            }
        }
        this.lastKnownStackCount = stackCount;
    }

    private processCooldownChanges(): void {
        if (this.lastKnownCooldownOffset === 0 || !this.settings.syncToCooldownOffset.get()) {
            return;
        }

        const cooldownTimerElement = getPxlsUICooldownTimer();
        const cooldownText = cooldownTimerElement.textContent.split(':');

        const minutes = cooldownText.at(0);
        const seconds = cooldownText.at(1);

        if (minutes == null || seconds == null) {
            return;
        }

        // this would theoretically break for offsets longer than a minute, but nobody should be using that anyway
        if (minutes !== '00') {
            return;
        }

        const secondsNumber = Number.parseInt(seconds, 10);
        if (Number.isNaN(secondsNumber)) {
            return;
        }

        if (secondsNumber === -this.lastKnownCooldownOffset) {
            this.runFlash();
        }
    }

    private createAnimationKeyframes(): Keyframe[] {
        const settingsKeyframes = this.settings.flashKeyframes.get();
        if (settingsKeyframes.length === 0) {
            return [];
        }

        const keyframesLength = settingsKeyframes.length;
        return settingsKeyframes.map(([color], index) => {
            const offset = index / keyframesLength;
            return {
                backgroundColor: color,
                offset,
            };
        });
    }

    private getTotalAnimationDuration(): number {
        return this.settings.flashKeyframes.get().reduce((total, [, time]) => total + time, 0);
    }

    private createKeyframeEffect(keyframes: Keyframe[]): KeyframeEffect {
        return new KeyframeEffect(this.flashOverlay, keyframes, {
            easing: `steps(${keyframes.length}, end)`,
            duration: this.getTotalAnimationDuration(),
        });
    }

    private runFlash(): void {
        if (this.runningAnimation || !this.settings.flashEnabled.get()) {
            return;
        }

        const keyframes = this.createAnimationKeyframes();
        if (keyframes.length === 0) {
            this.messenger.showErrorMessage('No valid keyframes for flash animation, so you get this message instead');
            return;
        }

        this.flashOverlay.classList.remove('dpus__stack-flasher--hidden');
        this.runningAnimation = new Animation(this.createKeyframeEffect(keyframes));
        this.runningAnimation.addEventListener('finish', () => {
            this.stopFlash();
        });
        this.runningAnimation.play();
    }

    private stopFlash(): void {
        this.runningAnimation?.cancel();
        this.runningAnimation = undefined;
        this.flashOverlay.classList.add('dpus__stack-flasher--hidden');
    }
}
