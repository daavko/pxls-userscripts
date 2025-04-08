import { z } from 'zod';
import type { PxlsApp } from '../pxls/pxls-global';
import { waitForAnimationFrame } from '../util/browser';
import { debug } from './debug';
import { showErrorMessage } from './message';
import { initTemplateEventHandlers } from './pxls-template';
import { findUIElements } from './pxls-ui';

export async function waitForApp(checkInterval = 1000): Promise<PxlsApp> {
    let app: PxlsApp;
    if (window.App) {
        debug('App found, checking login state');
        if (window.App.user.isLoggedIn()) {
            debug('User already logged in, resolving immediately');
            await waitForAnimationFrame();
            app = window.App;
        } else {
            debug('User not logged in, waiting for login state');
            await waitForLogin();
            await waitForAnimationFrame();
            debug('Login state successful, resolving');
            app = window.App;
        }
    } else {
        debug('App not found, waiting for App...');
        app = await new Promise<PxlsApp>((resolve) => {
            const checkIntervalId = setInterval(async () => {
                if (window.App) {
                    clearInterval(checkIntervalId);
                    debug('App found, waiting for login state');
                    const innerApp = window.App;
                    await waitForLogin();
                    await waitForAnimationFrame();
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

async function waitForLogin(): Promise<void> {
    return new Promise((resolve) => {
        $(window).on('pxls:user:loginState', (_event, loggedIn: unknown) => {
            const loggedInParseResult = z.boolean().safeParse(loggedIn);
            if (loggedInParseResult.success) {
                if (loggedInParseResult.data) {
                    debug('User logged in, resolving');
                    resolve();
                } else {
                    debug('User not logged in, waiting for login state');
                }
            } else {
                showErrorMessage('Login state received is not a boolean', loggedInParseResult.error);
            }
        });
    });
}
