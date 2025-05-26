import type { PxlsChromeOffsetWorkaroundModule } from '../../pxls/pxls-modules';
import type { ModuleExport, ModuleImportFunction } from './types';
import { DEFAULT_BROKEN_SCRIPT } from './util';

declare const requireFn: ModuleImportFunction;
declare const moduleExport: ModuleExport<'chromeOffsetWorkaround'>;

const { settings } = requireFn('./settings');

const settingElement = $('#chrome-canvas-offset-setting');

const init = (): void => {
    settings.fix.chrome.offset.enable.controls.remove(settingElement);
    settingElement.parent().remove();
};
moduleExport.exports.chromeOffsetWorkaround = {
    init,
    update: (): void => {
        /* intentionally empty */
    },
} satisfies PxlsChromeOffsetWorkaroundModule;

export default DEFAULT_BROKEN_SCRIPT;
