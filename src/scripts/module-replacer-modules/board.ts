import type { ModuleReplacementFunction } from './types';

export const boardModuleFn: ModuleReplacementFunction<'board'> = (requireFn, moduleExport) => {
    'use strict';
    // todo: implement

    const initInteraction = (): void => {};

    moduleExport.exports.board = {
        init: () => {},
        start: () => {},
        update: () => {},
        getScale: () => {},
        nudgeScale: () => {},
        setScale: () => {},
        getPixelIndex: () => {},
        setPixelIndex: () => {},
        fromScreen: () => {},
        toScreen: () => {},
        save: () => {},
        centerOn: () => {},
        getRenderBoard: () => {},
        getContainer: () => {},
        getWidth: () => {},
        getHeight: () => {},
        refresh: () => {},
        updateViewport: () => {},
        allowDrag: false,
        setAllowDrag: () => {},
        validateCoordinates: () => true,
        webInfo: false,
        snipMode: false,
    };
};
