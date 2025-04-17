import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug } from '../modules/debug';
import { showErrorMessage, showInfoMessage } from '../modules/message';
import { getApp, globalInit, waitForApp } from '../modules/pxls-init';
import { createScriptSettings, getGlobalSettings, initGlobalSettings } from '../modules/settings';
import {
    createBooleanSetting,
    createSettingsResetButton,
    createSettingsUI,
    createStringSetting,
} from '../modules/settings-ui';
import type { NonNullableKeys } from '../util/types';

globalInit({ scriptId: 'milestoneWatcher', scriptName: 'Milestone watcher' });
initGlobalSettings();

const milestoneSchema = v.pipe(
    v.string(),
    v.rawTransform((ctx) => {
        if (ctx.dataset.value.trim() === '') {
            return [];
        }

        const split = ctx.dataset.value.split(',').map((s) => s.trim());
        const nums: number[] = [];
        for (const s of split) {
            const num = Number.parseInt(s, 10);
            if (Number.isNaN(num)) {
                ctx.addIssue({
                    expected: 'number',
                    received: 'NaN',
                    message: `Invalid milestone: ${s}`,
                });
            } else {
                nums.push(num);
            }
        }
        return nums;
    }),
);

const rawMilestoneSchema = v.pipe(
    v.string(),
    v.check((str) => {
        if (str.trim() === '') {
            return true;
        }
        const split = str.split(',').map((s) => s.trim());
        return split.every((s) => !Number.isNaN(Number(s)));
    }),
);

const settingsSchema = v.partial(
    v.object({
        currentCanvasMilestones: rawMilestoneSchema,
        allTimeMilestones: rawMilestoneSchema,
        watchCanvasThousands: v.boolean(),
        watchAllTimeThousands: v.boolean(),
    }),
);
type SettingsType = NonNullableKeys<InferOutput<typeof settingsSchema>>;
const settingsDefault: SettingsType = {
    currentCanvasMilestones: '69,420,727,1337,10000',
    allTimeMilestones: '727727',
    watchCanvasThousands: false,
    watchAllTimeThousands: false,
};
const settings = createScriptSettings(settingsSchema, settingsDefault, {
    currentCanvasMilestones: [
        (_, newValue): void => {
            currentCanvasMilestones = getMilestones(newValue);
        },
    ],
    allTimeMilestones: [
        (_, newValue): void => {
            allTimeMilestones = getMilestones(newValue);
        },
    ],
});

let currentCanvasMilestones: number[] = [];
let allTimeMilestones: number[] = [];

function initSettings(): void {
    createSettingsUI(() => [
        createBooleanSetting(getGlobalSettings(), 'debug', 'Debug logging'),
        createStringSetting(settings, 'currentCanvasMilestones', 'Current canvas milestones (comma-separated)'),
        createStringSetting(settings, 'allTimeMilestones', 'All-time milestones (comma-separated)'),
        createBooleanSetting(settings, 'watchCanvasThousands', 'Notify every 1000 pixels on current canvas'),
        createBooleanSetting(settings, 'watchAllTimeThousands', 'Notify every 1000 all-time pixels'),
        createSettingsResetButton(),
    ]);
}

function initPixelCountListener(): void {
    const app = getApp();

    $(window).on('pxls:pixelCounts:update', () => {
        const currentCanvasCount = app.user.getPixelCount();
        const allTimeCount = app.user.getPixelCountAllTime();

        const currentCanvasMilestone = checkMilestone(currentCanvasCount, currentCanvasMilestones);
        const allTimeMilestone = checkMilestone(allTimeCount, allTimeMilestones);

        if (currentCanvasMilestone != null) {
            showInfoMessage(`You have reached a milestone on the current canvas: ${currentCanvasMilestone}`, 7000);
        }

        if (allTimeMilestone != null) {
            showInfoMessage(`You have reached an all-time milestone: ${allTimeMilestone}`, 7000);
        }

        if (settings.get('watchCanvasThousands') && currentCanvasCount % 1000 === 0) {
            showInfoMessage(`You have reached ${currentCanvasCount} pixels on the current canvas!`, 7000);
        }

        if (settings.get('watchAllTimeThousands') && allTimeCount % 1000 === 0) {
            showInfoMessage(`You have reached ${allTimeCount} all-time pixels!`, 7000);
        }
    });
}

async function init(): Promise<void> {
    await waitForApp();

    debug('Initializing script');

    initSettings();
    currentCanvasMilestones = getMilestones(settings.get('currentCanvasMilestones'));
    allTimeMilestones = getMilestones(settings.get('allTimeMilestones'));

    initPixelCountListener();
}

function getMilestones(milestonesSettingValue: string): number[] {
    return v.parse(milestoneSchema, milestonesSettingValue);
}

function checkMilestone(count: number, milestones: number[]): number | null {
    return milestones.find((m) => m === count) ?? null;
}

init().catch((e: unknown) => {
    if (e instanceof Error) {
        showErrorMessage(`Error during initialization: ${e.message}`, e);
        return;
    } else {
        showErrorMessage('Unknown error during initialization', new Error('Unknown error', { cause: e }));
    }
});
