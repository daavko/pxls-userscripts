import * as v from 'valibot';
import { getApp, waitForApp } from '../modules/pxls-init';
import { BooleanSetting, SettingBase, Settings, type SettingUpdateCallback } from '../modules/settings';
import {
    createBooleanSetting,
    createSettingsResetButton,
    createSettingsUI,
    createStringSetting,
} from '../modules/settings-ui';
import { PxlsUserscript } from './userscript';

const milestoneSchema = v.pipe(
    v.string(),
    v.trim(),
    v.rawTransform((ctx) => {
        return ctx.dataset.value.split(',').map((s) => s.trim());
    }),
    v.filterItems((item) => item !== ''),
    v.mapItems((item) => Number.parseInt(item, 10)),
    v.array(v.number()),
);

class MilestoneSetting extends SettingBase<number[], string> {
    constructor(defaultValue: number[], valueUpdateCallbacks: SettingUpdateCallback<number[]>[] = []) {
        super(defaultValue, milestoneSchema, valueUpdateCallbacks);
    }

    override serializeValue(value: number[]): string {
        return value.join(',');
    }
}

export class MilestoneWatcherScript extends PxlsUserscript {
    private readonly settings = Settings.create('milestoneWatcher', {
        currentCanvasMilestones: new MilestoneSetting([69, 420, 727, 1337, 10000]),
        allTimeMilestones: new MilestoneSetting([727727]),
        watchCanvasThousands: new BooleanSetting(false),
        watchAllTimeThousands: new BooleanSetting(false),
    });

    constructor() {
        super('Milestone Watcher', undefined, async () => this.initAfterApp());
    }

    private initSettings(): void {
        const { settings } = this;
        createSettingsUI('milestoneWatcher', 'DPUS Milestone Watcher', () => [
            createStringSetting(settings.currentCanvasMilestones, 'Current canvas milestones (comma-separated)'),
            createStringSetting(settings.allTimeMilestones, 'All-time milestones (comma-separated)'),
            createBooleanSetting(settings.watchCanvasThousands, 'Notify every 1000 pixels on current canvas'),
            createBooleanSetting(settings.watchAllTimeThousands, 'Notify every 1000 all-time pixels'),
            createSettingsResetButton(settings),
        ]);
    }

    private initPixelCountListener(): void {
        const { settings, messenger } = this;

        const app = getApp();

        $(window).on('pxls:pixelCounts:update', () => {
            const currentCanvasCount = app.user.getPixelCount();
            const allTimeCount = app.user.getPixelCountAllTime();

            const currentCanvasMilestone = this.checkMilestone(
                currentCanvasCount,
                settings.currentCanvasMilestones.get(),
            );
            const allTimeMilestone = this.checkMilestone(allTimeCount, settings.allTimeMilestones.get());

            if (currentCanvasMilestone != null) {
                messenger.showInfoMessage(
                    `You have reached a milestone on the current canvas: ${currentCanvasMilestone}`,
                    7000,
                );
            }

            if (allTimeMilestone != null) {
                messenger.showInfoMessage(`You have reached an all-time milestone: ${allTimeMilestone}`, 7000);
            }

            if (settings.watchCanvasThousands.get() && currentCanvasCount % 1000 === 0) {
                messenger.showInfoMessage(`You have reached ${currentCanvasCount} pixels on the current canvas!`, 7000);
            }

            if (settings.watchAllTimeThousands.get() && allTimeCount % 1000 === 0) {
                messenger.showInfoMessage(`You have reached ${allTimeCount} all-time pixels!`, 7000);
            }
        });
    }

    private checkMilestone(count: number, milestones: number[]): number | null {
        return milestones.find((m) => m === count) ?? null;
    }

    private async initAfterApp(): Promise<void> {
        await waitForApp();

        this.initSettings();

        this.initPixelCountListener();
    }
}
