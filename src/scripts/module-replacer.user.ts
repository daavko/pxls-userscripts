import { type ModuleReplacement, registerModuleReplacement } from '../modules/pxls-module-replacement';
import boardModuleFnSrc from './module-replacer-modules/board.pxls-module';
import chromeOffsetWorkaroundModuleFnSrc from './module-replacer-modules/chrome-offset-workaround.pxls-module';
import { PxlsUserscript } from './userscript';

const boardModuleReplacement: ModuleReplacement = {
    moduleName: 'board',
    replacementFunctionSrc: boardModuleFnSrc,
};

const chromeOffsetWorkaroundModuleReplacement: ModuleReplacement = {
    moduleName: 'chromeOffsetWorkaround',
    replacementFunctionSrc: chromeOffsetWorkaroundModuleFnSrc,
};

const PXLS_JS_HASH = '7536464be1e6f06b947e31ffbe893a26f1878cd1';

export class ModuleReplacerScript extends PxlsUserscript {
    constructor() {
        super('Module replacer', () => {
            this.registerModuleReplacements();
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
        } else {
            this.messenger.showErrorMessage(
                'Your browser does not support WebGL2, which is required for this script to work. If you think your browser supports WebGL2, please contact the script author.',
            );
        }
    }
}
