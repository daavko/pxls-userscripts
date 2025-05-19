import { globalInit } from '../modules/pxls-init';
import { type ModuleReplacement, registerModuleReplacement } from '../modules/pxls-module-replacement';
import { initGlobalSettings } from '../modules/settings';
import { boardModuleFn } from './module-replacer-modules/board';
import { chromeOffsetWorkaroundModuleFn } from './module-replacer-modules/chrome-offset-workaround';

globalInit({ scriptId: 'moduleReplacer', scriptName: 'Module replacer' });
initGlobalSettings();

const boardModuleReplacement: ModuleReplacement<'board'> = {
    moduleName: 'board',
    replacementFunction: boardModuleFn,
};

const chromeOffsetWorkaroundModuleReplacement: ModuleReplacement<'chromeOffsetWorkaround'> = {
    moduleName: 'chromeOffsetWorkaround',
    replacementFunction: chromeOffsetWorkaroundModuleFn,
};

const pxlsJsHash = '7536464be1e6f06b947e31ffbe893a26f1878cd1';
registerModuleReplacement(pxlsJsHash, boardModuleReplacement);
registerModuleReplacement(pxlsJsHash, chromeOffsetWorkaroundModuleReplacement);
