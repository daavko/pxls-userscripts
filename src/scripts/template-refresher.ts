import { getApp } from '../modules/pxls-init';
import { getCurrentTemplate } from '../modules/pxls-template';
import { getPxlsUITemplateUrlInput } from '../modules/pxls-ui';
import { BooleanSetting, NumberSetting, Settings } from '../modules/settings';
import {
    createBooleanSetting,
    createNumberSetting,
    createSettingsText,
    createSettingsUI,
} from '../modules/settings-ui';
import { PxlsUserscript } from './userscript';

export class TemplateRefresher extends PxlsUserscript {
    private readonly settings = Settings.create('templateRefresher', {
        enabled: new BooleanSetting(true, [
            (_, newValue): void => {
                if (newValue) {
                    this.startRefreshLoop(this.settings.refreshIntervalSeconds.get());
                } else {
                    this.stopRefreshLoop();
                }
            },
        ]),
        refreshIntervalSeconds: new NumberSetting(300, [
            (_, newValue): void => {
                if (this.settings.enabled.get()) {
                    this.startRefreshLoop(newValue);
                }
            },
        ]),
    });

    private activeIntervalId: number | null = null;

    constructor() {
        super('Template Refresher', undefined, () => {
            this.initSettings();
            if (this.settings.enabled.get()) {
                this.startRefreshLoop(this.settings.refreshIntervalSeconds.get());
            }
        });
    }

    private initSettings(): void {
        const { settings } = this;
        createSettingsUI('templateRefresher', 'DPUS Template Refresher', () => [
            createBooleanSetting(settings.enabled, 'Enable automatic template refreshing'),
            createNumberSetting(settings.refreshIntervalSeconds, 'Template refresh interval (seconds)', { min: 1 }),
            createSettingsText(
                "Due to the way Pxls handles scripted template updates, the template will flicker briefly when refreshing. There's nothing I can do about that.",
            ),
        ]);
    }

    private startRefreshLoop(interval: number): void {
        this.stopRefreshLoop();
        this.activeIntervalId = window.setInterval(() => {
            this.doTemplateRefresh();
        }, interval * 1000);
    }

    private stopRefreshLoop(): void {
        if (this.activeIntervalId !== null) {
            clearInterval(this.activeIntervalId);
            this.activeIntervalId = null;
        }
    }

    private doTemplateRefresh(): void {
        const template = getCurrentTemplate();
        if (!template) {
            return;
        }

        const app = getApp();
        const templateUrl = getPxlsUITemplateUrlInput().value;
        const { x, y, width } = template;

        app.updateTemplate({ url: '' });
        setTimeout(() => {
            app.updateTemplate({ url: templateUrl, x, y, width, use: true });
        }, 250);
    }
}
