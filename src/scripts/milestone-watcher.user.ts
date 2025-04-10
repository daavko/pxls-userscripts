import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug, setDebugName } from '../modules/debug';
import { setMessagePrefix, showErrorMessage, showInfoMessage } from '../modules/message';
import { getApp, globalInit, waitForApp } from '../modules/pxls-init';
import {
    booleanSerializer,
    createScriptSettings,
    getGlobalSettings,
    initGlobalSettings,
    stringSerializer,
    type ValueSerializerMap,
} from '../modules/settings';
import { createBooleanSetting, createSettingsUI, createStringSetting } from '../modules/settings-ui';
import type { NonNullableKeys } from '../util/types';

globalInit();
setDebugName('Milestone watcher');
setMessagePrefix('Milestone watcher');
initGlobalSettings('dpus_milestoneWatcher_globalSettings');

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
const settingsValueSerializerMap: ValueSerializerMap<SettingsType> = {
    currentCanvasMilestones: stringSerializer,
    allTimeMilestones: stringSerializer,
    watchCanvasThousands: booleanSerializer,
    watchAllTimeThousands: booleanSerializer,
};
const settings = createScriptSettings(
    'dpus_milestoneWatcher_settings',
    settingsSchema,
    settingsDefault,
    settingsValueSerializerMap,
);

function initSettings(): void {
    createSettingsUI('Milestone watcher', () => [
        createBooleanSetting(getGlobalSettings(), 'debug', 'Debug logging'),
        createStringSetting(settings, 'currentCanvasMilestones', 'Current canvas milestones (comma-separated)'),
        createStringSetting(settings, 'allTimeMilestones', 'All-time milestones (comma-separated)'),
        createBooleanSetting(settings, 'watchCanvasThousands', 'Notify every 1000 pixels on current canvas'),
        createBooleanSetting(settings, 'watchAllTimeThousands', 'Notify every 1000 all-time pixels'),
    ]);
}

function initPixelCountListener(): void {
    const app = getApp();
    $(window).on('pxls:pixelCounts:update', () => {
        const currentCanvasCount = app.user.getPixelCount();
        const allTimeCount = app.user.getPixelCountAllTime();

        const currentCanvasMilestone = checkMilestone(currentCanvasCount, settings.get('currentCanvasMilestones'));
        const allTimeMilestone = checkMilestone(allTimeCount, settings.get('allTimeMilestones'));

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
    initPixelCountListener();
}

function checkMilestone(count: number, milestonesSettingValue: string): number | null {
    const milestones = v.parse(milestoneSchema, milestonesSettingValue);
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
