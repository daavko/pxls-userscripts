import * as v from 'valibot';
import type { PxlsApp } from '../pxls/pxls-global';
import { waitForAnimationFrame } from '../util/browser';
import { debug } from './debug';
import { showErrorMessage } from './message';
import { initTemplateEventHandlers } from './pxls-template';
import { findUIElements } from './pxls-ui';

declare global {
    interface Window {
        dpus?: Partial<DPUS>;
    }

    interface DPUS {
        global: {
            scripts: string[];
        };
    }
}

export interface ScriptInitParams {
    scriptId: string;
    scriptName: string;
}

let SCRIPT_ID: string | null = null;
let SCRIPT_NAME: string | null = null;

export function getScriptId(): string {
    if (SCRIPT_ID === null) {
        throw new Error('Script ID is not set. Call globalInit() first.');
    }
    return SCRIPT_ID;
}

export function getScriptName(): string {
    if (SCRIPT_NAME === null) {
        throw new Error('Script name is not set. Call globalInit() first.');
    }
    return SCRIPT_NAME;
}

export function globalInit(initParams: ScriptInitParams): void {
    const { scriptId, scriptName } = initParams;
    const dpusGlobal = getDpusGlobal();
    if (!dpusGlobal.scripts.includes(scriptId)) {
        dpusGlobal.scripts.push(scriptId);
    } else {
        throw new Error(`Script ${scriptId} already initialized`);
    }
    SCRIPT_ID = scriptId;
    SCRIPT_NAME = scriptName;
}

export async function waitForApp(checkInterval = 1000): Promise<PxlsApp> {
    let app: PxlsApp;
    if (window.App) {
        debug('App found, checking login state');
        await waitForLogin();
        debug('Login state successful, resolving');
        app = window.App;
    } else {
        debug('App not found, waiting for App...');
        app = await new Promise<PxlsApp>((resolve) => {
            const checkIntervalId = setInterval(async () => {
                if (window.App) {
                    clearInterval(checkIntervalId);
                    debug('App found, waiting for login state');
                    const innerApp = window.App;
                    await waitForLogin();
                    debug('Login state successful, resolving');
                    resolve(innerApp);
                }
            }, checkInterval);
        });
    }

    findUIElements();
    initTemplateEventHandlers();

    return app;
}

export function getApp(): PxlsApp {
    if (!window.App) {
        throw new Error('App is not initialized');
    }
    return window.App;
}

export function getDpus(): Partial<DPUS> {
    window.dpus ??= {};
    return window.dpus;
}

export function getDpusGlobal(): DPUS['global'] {
    const dpus = getDpus();
    dpus.global ??= {
        scripts: [],
    };
    return dpus.global;
}

async function waitForLogin(): Promise<void> {
    const app = getApp();
    if (app.user.isLoggedIn()) {
        debug('User already logged in, resolving immediately');
        await waitForAnimationFrame();
        return;
    } else {
        return new Promise((resolve) => {
            $(window).on('pxls:user:loginState', (_event, loggedIn: unknown) => {
                const loggedInParseResult = v.safeParse(v.boolean(), loggedIn);
                if (loggedInParseResult.success) {
                    if (loggedInParseResult.output) {
                        debug('User logged in, resolving');
                        resolve();
                    } else {
                        debug('User not logged in, waiting for login state');
                    }
                } else {
                    const errorMessage = 'Login state received is not a boolean';
                    showErrorMessage(errorMessage, new Error(errorMessage, { cause: loggedInParseResult.issues }));
                }
            });
        });
    }
}
