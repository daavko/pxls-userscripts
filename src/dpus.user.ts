import { debug } from './modules/debug';
import { Messenger } from './modules/message';
import { waitForApp } from './modules/pxls-init';
import { initTemplateEventHandlers } from './modules/pxls-template';
import { findUIElements } from './modules/pxls-ui';
import { BooleanSetting, GLOBAL_SETTINGS, Settings } from './modules/settings';
import {
    createBooleanSetting,
    createLineBreak,
    createSettingsResetButton,
    createSettingsText,
    createSettingsUI,
    createSubheading,
} from './modules/settings-ui';
import { isUserInList } from './modules/userlist';
import { AutoColorSelectorScript } from './scripts/auto-color-selector.user';
import { GriefTrackerScript } from './scripts/grief-tracker.user';
import { MilestoneWatcherScript } from './scripts/milestone-watcher.user';
import { TemplateInfoScript } from './scripts/template-info.user';
import type { PxlsUserscript } from './scripts/userscript';

const messenger = new Messenger('DPUS');

const settings = Settings.create('global', {
    templateInfoEnabled: new BooleanSetting(false),
    autoColorSelectorScriptEnabled: new BooleanSetting(false),
    griefTrackerScriptEnabled: new BooleanSetting(false),
    milestoneWatcherScriptEnabled: new BooleanSetting(false),
});

function initSettings(): void {
    createSettingsUI('global', 'DPUS Global Settings', () => [
        createSubheading('General settings'),
        createBooleanSetting(GLOBAL_SETTINGS.debug, 'Debug mode'),
        createLineBreak(),
        createSubheading('Scripts'),
        createSettingsText('A reload is required for changes to take effect.'),
        createBooleanSetting(settings.templateInfoEnabled, 'Template Info'),
        createBooleanSetting(settings.autoColorSelectorScriptEnabled, 'Auto Color Selector'),
        createBooleanSetting(settings.griefTrackerScriptEnabled, 'Grief Tracker'),
        createBooleanSetting(settings.milestoneWatcherScriptEnabled, 'Milestone Watcher'),
        createSettingsResetButton(settings),
    ]);
}

const FIRST_LAUNCH_KEY = 'dpus_first_launch';

function dpusHasBeenLaunchedBefore(): boolean {
    return window.localStorage.getItem(FIRST_LAUNCH_KEY) !== null;
}

function setDpusHasBeenLaunchedBefore(): void {
    window.localStorage.setItem(FIRST_LAUNCH_KEY, 'true');
}

async function init(): Promise<void> {
    if (window.App) {
        messenger.showErrorMessage('Pxls is already initialized, DPUS cannot initialize at this point.');
    }

    const scripts: PxlsUserscript[] = [];
    if (settings.templateInfoEnabled.get()) {
        scripts.push(new TemplateInfoScript());
    }
    if (settings.autoColorSelectorScriptEnabled.get()) {
        scripts.push(new AutoColorSelectorScript());
    }
    if (settings.griefTrackerScriptEnabled.get()) {
        scripts.push(new GriefTrackerScript());
    }
    if (settings.milestoneWatcherScriptEnabled.get()) {
        scripts.push(new MilestoneWatcherScript());
    }

    if (scripts.length > 0) {
        setDpusHasBeenLaunchedBefore();
    }

    const failedScripts = new Set<string>();
    for (const script of scripts) {
        if (script.beforeApp) {
            try {
                script.beforeApp();
            } catch (e: unknown) {
                if (e instanceof Error) {
                    messenger.showErrorMessage(`Error in beforeApp of script "${script.name}": ${e.message}`, e);
                } else {
                    messenger.showErrorMessage(
                        `Error in beforeApp of script "${script.name}"`,
                        new Error(String(e), { cause: e }),
                    );
                }
                failedScripts.add(script.name);
            }
        }
    }

    const app = await waitForApp();

    try {
        if (await isUserInList(app.user.getUsername(), 'https://pxls.daavko.moe/userscripts/banlist.json')) {
            messenger.showErrorMessage('You are banned from using this script.');
            return;
        }
    } catch (e: unknown) {
        debug('Failed to check if user is banned:', e);
    }

    if (Reflect.has(window, 'dpus')) {
        messenger.showErrorMessage('Found old scripts, please remove them before using the unified Utility Scripts.');
        return;
    }

    findUIElements();
    initTemplateEventHandlers();

    initSettings();

    for (const script of scripts) {
        if (failedScripts.has(script.name)) {
            debug(`Skipping script "${script.name}" due to previous errors.`);
            continue;
        }
        if (script.afterApp) {
            try {
                const afterAppReturnValue = script.afterApp(app);
                if (afterAppReturnValue instanceof Promise) {
                    await afterAppReturnValue;
                }
            } catch (e: unknown) {
                if (e instanceof Error) {
                    messenger.showErrorMessage(`Error in afterApp of script "${script.name}": ${e.message}`, e);
                } else {
                    messenger.showErrorMessage(
                        `Error in afterApp of script "${script.name}"`,
                        new Error(String(e), { cause: e }),
                    );
                }
                failedScripts.add(script.name);
            }
        }
    }

    debug(`DPUS initialized with ${scripts.length} scripts.`);
    if (failedScripts.size > 0) {
        debug(`Failed to initialize scripts: ${Array.from(failedScripts).join(', ')}`);
    }

    if (!dpusHasBeenLaunchedBefore()) {
        messenger.showInfoMessage(
            'Please check the bottom of Pxls settings to enable or disable available scripts',
            10_000,
        );
    }

    setDpusHasBeenLaunchedBefore();
}

init().catch((e: unknown) => {
    if (e instanceof Error) {
        messenger.showErrorMessage(`Error during initialization: ${e.message}`, e);
        return;
    } else {
        messenger.showErrorMessage('Unknown error during initialization', new Error('Unknown error', { cause: e }));
    }
});
