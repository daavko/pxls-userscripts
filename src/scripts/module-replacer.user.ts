import { showErrorMessage } from '../modules/message';
import { globalInit } from '../modules/pxls-init';
import { type ModuleReplacement, registerModuleReplacement } from '../modules/pxls-module-replacement';
import { initGlobalSettings } from '../modules/settings';
import boardModuleFnSrc from './module-replacer-modules/board.pxls-module';
import chromeOffsetWorkaroundModuleFnSrc from './module-replacer-modules/chrome-offset-workaround.pxls-module';

globalInit({ scriptId: 'moduleReplacer', scriptName: 'Module replacer' });
initGlobalSettings();

const boardModuleReplacement: ModuleReplacement = {
    moduleName: 'board',
    replacementFunctionSrc: boardModuleFnSrc,
};

const chromeOffsetWorkaroundModuleReplacement: ModuleReplacement = {
    moduleName: 'chromeOffsetWorkaround',
    replacementFunctionSrc: chromeOffsetWorkaroundModuleFnSrc,
};

const pxlsJsHash = '7536464be1e6f06b947e31ffbe893a26f1878cd1';

function checkWebGL2Compatibility(): boolean {
    const canvas = new OffscreenCanvas(1, 1);
    const gl = canvas.getContext('webgl2');
    return gl !== null && gl instanceof WebGL2RenderingContext;
}

function registerModuleReplacements(): void {
    if (checkWebGL2Compatibility()) {
        registerModuleReplacement(pxlsJsHash, boardModuleReplacement);
        registerModuleReplacement(pxlsJsHash, chromeOffsetWorkaroundModuleReplacement);
    } else {
        showErrorMessage(
            'Your browser does not support WebGL2, which is required for this script to work. If you think your browser supports WebGL2, please contact the script author.',
        );
    }
}

registerModuleReplacements();
