import {
    type ModuleReplacement,
    registerModuleReplacement,
    waitForModuleReplacement,
} from '../modules/pxls-module-replacement';
import { bindWebSocketProxy } from '../modules/websocket';
import boardModuleFnSrc from './module-replacer-modules/board.pxls-module';
import chromeOffsetWorkaroundModuleFnSrc from './module-replacer-modules/chrome-offset-workaround.pxls-module';
import coordsModuleFnSrc from './module-replacer-modules/coords.pxls-module';
import { PxlsUserscript } from './userscript';

const boardModuleReplacement: ModuleReplacement = {
    moduleName: 'board',
    replacementFunctionSrc: boardModuleFnSrc,
};

const chromeOffsetWorkaroundModuleReplacement: ModuleReplacement = {
    moduleName: 'chromeOffsetWorkaround',
    replacementFunctionSrc: chromeOffsetWorkaroundModuleFnSrc,
};

const coordsModuleReplacement: ModuleReplacement = {
    moduleName: 'coords',
    replacementFunctionSrc: coordsModuleFnSrc,
};

const PXLS_JS_HASH = '698cf30e3c16ad8f1712171bd22ebfac0087b45adef3df2a7e1e13347ad63114';

export class ModuleReplacerScript extends PxlsUserscript {
    constructor() {
        super('Module replacer', () => {
            this.registerModuleReplacements();
            bindWebSocketProxy();
            waitForModuleReplacement().catch((e: unknown) => {
                if (e instanceof Error) {
                    this.messenger.showErrorMessage(
                        `An error occurred while waiting for module replacement: ${e.message}`,
                        e,
                    );
                } else {
                    this.messenger.showErrorMessage(
                        'An unknown error occurred while waiting for module replacement.',
                        new Error('Unknown error', { cause: e }),
                    );
                }
            });
        });
    }

    private checkWebGL2Compatibility(): boolean {
        const canvas = new OffscreenCanvas(1, 1);
        const gl = canvas.getContext('webgl2');
        return gl !== null && gl instanceof WebGL2RenderingContext;
    }

    private registerModuleReplacements(): void {
        if (this.checkWebGL2Compatibility()) {
            registerModuleReplacement(PXLS_JS_HASH, boardModuleReplacement);
            registerModuleReplacement(PXLS_JS_HASH, chromeOffsetWorkaroundModuleReplacement);
            registerModuleReplacement(PXLS_JS_HASH, coordsModuleReplacement);
        } else {
            this.messenger.showErrorMessage(
                'Your browser does not support WebGL2, which is required for this script to work. If you think your browser supports WebGL2, please contact the script author.',
            );
        }
    }
}
