import { showErrorMessage } from '../modules/message';
import { globalInit, waitForApp } from '../modules/pxls-init';
import { getFastLookupPalette } from '../modules/pxls-palette';
import { initGlobalSettings } from '../modules/settings';

globalInit({ scriptId: 'advancedTemplateRenderer', scriptName: 'Advanced template renderer' });
initGlobalSettings();

let palette: number[] = [];

async function init(): Promise<void> {
    await waitForApp();
    palette = await getFastLookupPalette();
}

init().catch((e: unknown) => {
    if (e instanceof Error) {
        showErrorMessage(`Error during initialization: ${e.message}`, e);
        return;
    } else {
        showErrorMessage('Unknown error during initialization', new Error('Unknown error', { cause: e }));
    }
});
