import type { PxlsExtendedBoardModule } from './pxls-modules-ext';

export interface PxlsAppExtensions {
    board?: PxlsExtendedBoardModule;
}

declare global {
    interface Window {
        AppExtensions?: PxlsAppExtensions;
    }
}
