import { Messenger } from '../modules/message';
import type { PxlsApp } from '../pxls/pxls-global';

export abstract class PxlsUserscript {
    protected messenger: Messenger;

    protected constructor(
        readonly name: string,
        readonly beforeApp?: () => void,
        readonly afterApp?: (app: PxlsApp) => void | Promise<void>,
    ) {
        this.messenger = new Messenger(name);
    }
}
