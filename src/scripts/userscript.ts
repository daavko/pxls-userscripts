import type { PxlsApp } from '../pxls/pxls-global';

export abstract class PxlsUserscript {
    protected constructor(
        readonly name: string,
        readonly beforeApp?: () => void,
        readonly afterApp?: (app: PxlsApp) => void | Promise<void>,
    ) {}
}
