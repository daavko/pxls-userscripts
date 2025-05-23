import type { PxlsChromeOffsetWorkaroundModule } from '../../pxls/pxls-modules';
import type { ModuleReplacementFunction } from './types';

export const chromeOffsetWorkaroundModuleFn: ModuleReplacementFunction<'chromeOffsetWorkaround'> = (
    requireFn,
    moduleExport,
) => {
    'use strict';
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
};
