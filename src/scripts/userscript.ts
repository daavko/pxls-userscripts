import type { PxlsApp } from '../pxls/pxls-global';

export abstract class PxlsUserscript {
    readonly requiresVirginmap: boolean = false;
    readonly requiresHeatmap: boolean = false;

    protected constructor(
        readonly name: string,
        readonly beforeApp?: () => void,
        readonly afterApp?: (app: PxlsApp) => void | Promise<void>,
    ) {}
}
