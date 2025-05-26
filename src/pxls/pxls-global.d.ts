import type {
    PxlsChatModule,
    PxlsExtendedBoardModule,
    PxlsLookupModule,
    PxlsOverlaysModule,
    PxlsQueryModule,
    PxlsSettingsModule,
    PxlsStorageModule,
    PxlsTemplateModule,
    PxlsUiHelperModule,
    PxlsUserModule,
} from './pxls-modules';

export interface PxlsApp {
    ls: PxlsStorageModule;

    ss: PxlsStorageModule;

    settings: PxlsSettingsModule;

    query: PxlsQueryModule;

    overlays: {
        add: PxlsOverlaysModule['add'];
        remove: PxlsOverlaysModule['remove'];
        readonly heatmap: {
            clear: () => void;
            reload: () => void;
        };
        readonly heatbackground: {
            reload: () => void;
        };
        readonly virginmap: {
            clear: () => void;
            reload: () => void;
        };
        readonly virginbackground: {
            reload: () => void;
        };
    };

    uiHelper: {
        readonly tabId: PxlsUiHelperModule['tabId'];
        tabHasFocus: PxlsUiHelperModule['tabHasFocus'];
        updateAudio: PxlsUiHelperModule['updateAudio'];
        handleFile: PxlsUiHelperModule['handleFile'];
    };

    template: {
        update: PxlsTemplateModule['queueUpdate'];
        normalize: PxlsTemplateModule['normalizeTemplateObj'];
    };

    lookup: {
        registerHook: PxlsLookupModule['registerHook'];
        replaceHook: PxlsLookupModule['replaceHook'];
        unregisterHook: PxlsLookupModule['unregisterHook'];
    };

    centerBoardOn: (x: number, y: number) => void;

    updateTemplate: () => void;

    alert: (message: string) => void;

    chat: PxlsChatModule;

    typeahead: {
        helper: unknown;
        suggesting: boolean;
        hasResults: boolean;
        highlightedIndex: number;
        lastLength: boolean;
        readonly shouldInsert: boolean;
    };

    user: {
        getUsername: PxlsUserModule['getUsername'];
        getPixelCount: PxlsUserModule['getPixelCount'];
        getPixelCountAllTime: PxlsUserModule['getPixelCountAllTime'];
        getRoles: PxlsUserModule['getRoles'];
        isLoggedIn: PxlsUserModule['isLoggedIn'];
        isStaff: PxlsUserModule['isStaff'];
        isDonator: PxlsUserModule['isDonator'];
        getPermissions: PxlsUserModule['getPermissions'];
        hasPermission: PxlsUserModule['hasPermission'];
    };

    modal: {
        showText: (text: string, opts: JQueryModalOptions) => unknown;
        show: (modal: HTMLElement, opts: JQueryModalOptions) => unknown;
        buildCloser: () => HTMLElement;
        buildDom: (
            headerContent: string | HTMLElement,
            bodyContent: string | HTMLElement,
            footerContent: string | HTMLElement,
        ) => HTMLElement;
        closeAll: (clearDom?: boolean) => void;
        closeTop: (clearDom?: boolean) => void;
    };
}

export interface JQueryModalOptions {
    blockerClass: string;
    clickClose: boolean;
    closeClass: string;
    closeExisting: boolean;
    closeText: string;
    escapeClose: boolean;
    fadeDelay: number;
    fadeDuration: number;
    modalClass: string;
    showClose: boolean;
    showSpinner: boolean;
    spinnerHtml: string;
}

export interface PxlsAppExtensions {
    board?: PxlsExtendedBoardModule;
}

declare global {
    interface Window {
        App?: PxlsApp;
        AppExtensions?: PxlsAppExtensions;
    }
}
