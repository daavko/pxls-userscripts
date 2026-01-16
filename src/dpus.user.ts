import { debug } from './modules/debug';
import { addStylesheet, removeStylesheet } from './modules/document';
import { Messenger } from './modules/message';
import { waitForApp } from './modules/pxls-init';
import { initTemplateEventHandlers } from './modules/pxls-template';
import { findUIElements } from './modules/pxls-ui';
import { BooleanSetting, GLOBAL_SETTINGS, Settings, type SettingUpdateCallback } from './modules/settings';
import {
    createBooleanSetting,
    createLineBreak,
    createSettingsResetButton,
    createSettingsText,
    createSettingsUI,
    createSubheading,
} from './modules/settings-ui';
import { AutoColorSelectorScript } from './scripts/auto-color-selector.user';
import { AvailablePixelsFlasherScript } from './scripts/available-pixels-flasher.user';
import { GriefTrackerScript } from './scripts/grief-tracker.user';
import { MilestoneWatcherScript } from './scripts/milestone-watcher.user';
import { PogpegaUtils } from './scripts/pogpega-utils.user';
import { TemplateInfoScript } from './scripts/template-info.user';
import { TemplateRefresher } from './scripts/template-refresher';
import type { PxlsUserscript } from './scripts/userscript';
import bubbleUnstupidifierStyles from './styles/bubble-unstupidifier.css';
import noMoveTemplateHereStyles from './styles/no-move-template-here.css';

const messenger = new Messenger('DPUS');

const settings = Settings.create('global', {
    templateInfoEnabled: new BooleanSetting(false),
    autoColorSelectorScriptEnabled: new BooleanSetting(false),
    griefTrackerScriptEnabled: new BooleanSetting(false),
    milestoneWatcherScriptEnabled: new BooleanSetting(false),
    availablePixelsFlasherEnabled: new BooleanSetting(false),
    pogpegaUtilsEnabled: new BooleanSetting(false),
    templateRefresherEnabled: new BooleanSetting(false),

    bubbleUnstupidifierStyleEnabled: new BooleanSetting(false, [
        createStyleSettingChangeHandler('dpus__global__bubble-unstupidifier'),
    ]),
    noMoveTemplateHereStyleEnabled: new BooleanSetting(false, [
        createStyleSettingChangeHandler('dpus__global__no-move-template-here'),
    ]),
});

const GLOBAL_STYLES = {
    'dpus__global__bubble-unstupidifier': bubbleUnstupidifierStyles,
    'dpus__global__no-move-template-here': noMoveTemplateHereStyles,
} as const;

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
        createBooleanSetting(settings.availablePixelsFlasherEnabled, 'Available Pixels Flasher'),
        createBooleanSetting(settings.pogpegaUtilsEnabled, 'Pogpega Utils'),
        createBooleanSetting(settings.templateRefresherEnabled, 'Template Refresher'),
        createLineBreak(),
        createSubheading('Styles'),
        createSettingsText('Those are just styles I prefer. Reload is not required for changes to take effect.'),
        createBooleanSetting(settings.bubbleUnstupidifierStyleEnabled, 'Info bubble improvements'),
        createBooleanSetting(settings.noMoveTemplateHereStyleEnabled, 'Remove "Move Template Here" button'),
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

function createStyleSettingChangeHandler(styleName: keyof typeof GLOBAL_STYLES): SettingUpdateCallback<boolean> {
    return (_, newValue): void => {
        handleStyleSettingChange(styleName, newValue);
    };
}

function handleStyleSettingChange(styleName: keyof typeof GLOBAL_STYLES, enabled: boolean): void {
    if (enabled) {
        addStylesheet(styleName, GLOBAL_STYLES[styleName]);
    } else {
        removeStylesheet(styleName);
    }
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
    if (settings.availablePixelsFlasherEnabled.get()) {
        scripts.push(new AvailablePixelsFlasherScript());
    }
    if (settings.pogpegaUtilsEnabled.get()) {
        scripts.push(new PogpegaUtils());
    }
    if (settings.templateRefresherEnabled.get()) {
        scripts.push(new TemplateRefresher());
    }

    if (scripts.length > 0) {
        setDpusHasBeenLaunchedBefore();
    }

    const styles: (keyof typeof GLOBAL_STYLES)[] = [];
    if (settings.bubbleUnstupidifierStyleEnabled.get()) {
        styles.push('dpus__global__bubble-unstupidifier');
    }
    if (settings.noMoveTemplateHereStyleEnabled.get()) {
        styles.push('dpus__global__no-move-template-here');
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

    for (const style of styles) {
        handleStyleSettingChange(style, true);
    }

    const app = await waitForApp();

    if (Reflect.has(window, 'dpus')) {
        messenger.showErrorMessage('Found old scripts, please remove them before using the unified Utility Scripts.');
        return;
    }

    findUIElements();
    initTemplateEventHandlers();

    initSettings();

    const anyScriptRequiresVirginmap = scripts.some((s) => s.requiresVirginmap);
    if (anyScriptRequiresVirginmap) {
        app.overlays.virginmap.reload();
    }

    const anyScriptRequiresHeatmap = scripts.some((s) => s.requiresHeatmap);
    if (anyScriptRequiresHeatmap) {
        app.overlays.heatmap.reload();
    }

    for (const script of scripts) {
        if (failedScripts.has(script.name)) {
            debug(`Skipping script "${script.name}" due to previous errors.`);
            continue;
        }
        if (script.afterApp) {
            try {
                await Promise.try(script.afterApp, app);
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
    } else {
        messenger.showErrorMessage('Unknown error during initialization', new Error('Unknown error', { cause: e }));
    }
});
