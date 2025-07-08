import * as v from 'valibot';
import type { PxlsApp } from '../pxls/pxls-global';
import { waitForAnimationFrame } from '../util/browser';
import { debug } from './debug';
import { GLOBAL_MESSENGER } from './message';

export async function waitForApp(checkInterval = 100): Promise<PxlsApp> {
    let app: PxlsApp;
    if (window.App) {
        debug('App found, checking login state');
        await waitForLogin();
        debug('Login state successful, resolving');
        app = window.App;
    } else {
        debug('App not found, waiting for App...');
        const { promise, resolve } = Promise.withResolvers<PxlsApp>();
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
        app = await promise;
    }
    return app;
}

export function getApp(): PxlsApp {
    if (!window.App) {
        throw new Error('App is not initialized');
    }
    return window.App;
}

async function waitForLogin(): Promise<void> {
    const app = getApp();
    if (app.user.isLoggedIn()) {
        debug('User already logged in, resolving immediately');
        await waitForAnimationFrame();
        return;
    } else {
        const { promise, resolve } = Promise.withResolvers<void>();
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
                GLOBAL_MESSENGER.showErrorMessage(
                    errorMessage,
                    new Error(errorMessage, { cause: loggedInParseResult.issues }),
                );
            }
        });
        return promise;
    }
}
