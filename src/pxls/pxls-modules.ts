import type { NullishKeys } from '../util/types';
import type { PxlsInfoResponse, PxlsLookupResponse } from './pxls-types';

export interface PxlsModules {
    board: PxlsBoardModule;
    chat: PxlsChatModule;
    chromeOffsetWorkaround: PxlsChromeOffsetWorkaroundModule;
    coords: PxlsCoordsModule;
    grid: PxlsGridModule;
    lookup: PxlsLookupModule;
    overlays: PxlsOverlaysModule;
    panels: PxlsPanelsModule;
    place: PxlsPlaceModule;
    query: PxlsQueryModule;
    settings: PxlsSettingsModule;
    socket: PxlsSocketModule;
    storage: PxlsStorageModule;
    template: PxlsTemplateModule;
    uiHelper: PxlsUiHelperModule;
    user: PxlsUserModule;
}

export interface PxlsModulesImportMap {
    './board': { board: PxlsBoardModule };
    './chat': { chat: PxlsChatModule };
    './chromeOffsetWorkaround': { chromeOffsetWorkaround: PxlsChromeOffsetWorkaroundModule };
    './coords': { coords: PxlsCoordsModule };
    './grid': { grid: PxlsGridModule };
    './helpers': {
        binaryAjax: (url: string) => Promise<Uint8Array>;
        createImageData: (width: number, height: number) => ImageData;
        intToHex: (int: number) => string;
        hexToRgb: (hex: string) => { r: number; g: number; b: number } | null;
        analytics: unknown;
        LazyPromise: unknown;
        flags: {
            haveZoomRendering: boolean;
            webkitBased: boolean;
            possiblyMobile: boolean;
            haveImageRendering: boolean;
        };
    };
    './lookup': { lookup: PxlsLookupModule };
    './overlays': { overlays: PxlsOverlaysModule };
    './panels': { panels: PxlsPanelsModule };
    './place': { place: PxlsPlaceModule };
    './query': { query: PxlsQueryModule };
    './settings': { settings: PxlsSettingsModule };
    './socket': { socket: PxlsSocketModule };
    './storage': {
        getCookie: (name: string) => string | undefined;
        setCookie: (name: string, value: string, days?: number) => void;
        ls: PxlsStorageModule;
        ss: PxlsStorageModule;
    };
    './template': { template: PxlsTemplateModule };
    './uiHelper': { uiHelper: PxlsUiHelperModule };
    './user': { user: PxlsUserModule };
}

export interface PxlsBoardModule {
    init: () => void;
    start: () => void;
    update: (optional: boolean, ignoreCanvasLock?: boolean) => boolean;
    getScale: () => number;
    nudgeScale: (adjustment: number) => void;
    setScale: (scale: number, doUpdate?: boolean) => void;
    getPixelIndex: (x: number, y: number) => number;
    setPixelIndex: (x: number, y: number, color: number, refresh?: boolean) => void;
    fromScreen: (screenX: number, screenY: number, floored?: boolean) => { x: number; y: number };
    toScreen: (boardX: number, boardY: number) => { x: number; y: number };
    save: () => void;
    centerOn: (x?: number | null, y?: number | null, ignoreLock?: boolean) => void;
    getRenderBoard: () => HTMLCanvasElement;
    getContainer: () => HTMLElement;
    getWidth: () => number;
    getHeight: () => number;
    refresh: () => void;
    updateViewport: (data: { scale?: number; x?: number; y?: number }) => void;
    readonly allowDrag: boolean;
    setAllowDrag: (allowDrag?: boolean | null) => void;
    validateCoordinates: (x: number, y: number) => boolean;
    readonly webInfo: PxlsInfoResponse | false;
    readonly snipMode: boolean;
}

export interface BoardRenderingContext {
    boardWidth: number;
    boardHeight: number;
    canvasWidth: number;
    canvasHeight: number;
}

export interface PxlsExtendedBoardRenderLayer {
    name: string;
    title: string;
    init: (ctx: WebGL2RenderingContext) => void;
    render: (ctx: WebGL2RenderingContext, boardCtx: BoardRenderingContext) => void;
}

export interface PxlsExtendedBoardModule {
    registerRenderLayer: (layer: PxlsExtendedBoardRenderLayer) => void;
    registerSimpleRenderLayer: (name: string, title: string, textureView: Uint32Array) => void;
}

export interface PxlsChatModule {
    init: () => Promise<void>;
    webinit: (data: PxlsInfoResponse) => Promise<void>;
    _handleActionClick: (e: MouseEvent) => void;
    clearPings: () => void;
    setCharLimit: (limit: number) => void;
    processMessage: (message: string, mentionCallback: () => void) => string;
    saveIgnores: () => void;
    reloadIgnores: () => void;
    addIgnore: (name: string) => void;
    removeIgnore: (name: string) => void;
    getIgnores: () => string[];
    typeahead: {
        helper: unknown;
        suggesting: boolean;
        hasResults: boolean;
        highlightedIndex: number;
        lastLength: boolean;
        readonly shouldInsert: boolean;
    };
    updateSelectedNameColor: (colorIndex: number) => void;
    updateCanvasBanState: (banned: boolean) => void;
    registerHook: (...hooks: PxlsAppChatHook[]) => void;
    replaceHook: (hookId: string, newHook: Omit<PxlsAppChatHook, 'id'>) => void;
    unregisterHook: (hookId: string) => void;
    readonly markdownProcessor: (...args: unknown[]) => void;
    readonly canvasBanRespected: boolean;
}

export interface PxlsChromeOffsetWorkaroundModule {
    init: () => void;
    update: () => void;
}

export interface PxlsCoordsModule {
    init: () => void;
    copyCoords: (useHash?: boolean) => void;
    getLinkToCoords: (x?: number, y?: number, scale?: number) => string;
    lockIcon: JQuery;
}

export interface PxlsGridModule {
    init: () => void;
    update: () => void;
}

export interface PxlsLookupModule {
    webinit: () => void;
    registerHandle: (handle: (lookup: PxlsLookupResponse) => void) => void;
    registerHook: (...hooks: PxlsAppLookupHook[]) => void;
    replaceHook: (hookId: string, newHook: Omit<PxlsAppLookupHook, 'id'>) => void;
    unregisterHook: (hookId: string) => void;
    runLookup: (x: number, y: number) => void;
    clearHandle: () => void;
}

export interface PxlsOverlaysModule {
    webinit: (data: PxlsInfoResponse) => void;
    add: (
        name: string,
        fetchData: () => Promise<void>,
        onLazyInit: (width: number, height: number, previouslyLazyInited: number) => void,
    ) => PxlsAppOverlay;
    remove: (name: string) => void;
    readonly heatmap: unknown;
    readonly heatbackground: unknown;
    readonly virginmap: unknown;
    readonly virginbackground: unknown;
}

export interface PxlsPanelsModule {
    init: () => void;
    open: (panel: string | HTMLElement) => void;
    close: (panel: string | HTMLElement) => void;
    toggle: (panel: string | HTMLElement, exclusive?: boolean) => void;
    isOpen: (panel: string | HTMLElement) => boolean;
    setEnabled: (panel: string | HTMLElement, enabled: boolean) => void;
    isEnabled: (panel: string | HTMLElement) => boolean;
}

export interface PxlsPlaceModule {
    init: () => void;
    update: (x?: number, y?: number) => void;
    place: (x: number, y: number, color: number | null) => void;
    switch: (color: number) => void;
    setPalette: (palette: PxlsInfoResponse['palette']) => void;
    readonly palette: PxlsInfoResponse['palette'];
    getPaletteColorValue: (index: number, def?: string) => string | undefined;
    getPaletteABGR: () => number[];
    togglePaletteSpecialColors: (show: boolean) => void;
    setAutoReset: (enabled?: boolean) => void;
    setNumberedPaletteEnabled: (enabled?: boolean) => void;
    readonly color: number;
    readonly lastPixel: { x: number; y: number; color: number } | null;
    toggleReticule: (show?: boolean) => void;
    toggleCursor: (show?: boolean) => void;
}

export interface PxlsQueryModule {
    init: () => void;
    get: (key: string) => string | undefined;
    set: {
        (key: string, value: string, silent?: boolean): void;
        (obj: Record<string, string>, silent?: boolean): void;
    };
    has: (key: string) => boolean;
    update: () => void;
    remove: (key: string, silent?: boolean) => void;
    lazy_update: () => void;
}

export interface PxlsSettingsModule {
    filter: {
        search: (query: string) => void;
    };
    ui: {
        language: {
            override: PxlsAppSetting<PxlsAppSettingType>;
        };
        theme: {
            index: PxlsAppSetting<PxlsAppSettingType>;
        };
        reticule: {
            enable: PxlsAppSetting<boolean>;
        };
        cursor: {
            enable: PxlsAppSetting<boolean>;
        };
        bubble: {
            position: PxlsAppSetting<PxlsAppSettingType>;
            compact: PxlsAppSetting<boolean>;
        };
        brightness: {
            enable: PxlsAppSetting<boolean>;
            value: PxlsAppSetting<number>;
        };
        palette: {
            numbers: {
                enable: PxlsAppSetting<boolean>;
            };
            scrollbar: {
                thin: {
                    enable: PxlsAppSetting<boolean>;
                };
            };
            stacking: {
                enable: PxlsAppSetting<boolean>;
            };
        };
        chat: {
            banner: {
                enable: PxlsAppSetting<boolean>;
            };
            horizontal: {
                enable: PxlsAppSetting<boolean>;
            };
            icon: {
                badge: PxlsAppSetting<PxlsAppSettingType>;
                color: PxlsAppSetting<PxlsAppSettingType>;
            };
        };
    };
    audio: {
        enable: PxlsAppSetting<boolean>;
        alert: {
            src: PxlsAppSetting<string>;
            volume: PxlsAppSetting<number>;
        };
    };
    board: {
        heatmap: {
            enable: PxlsAppSetting<boolean>;
            opacity: PxlsAppSetting<number>;
        };
        virginmap: {
            enable: PxlsAppSetting<boolean>;
            opacity: PxlsAppSetting<number>;
        };
        grid: {
            enable: PxlsAppSetting<boolean>;
        };
        lock: {
            enable: PxlsAppSetting<boolean>;
        };
        zoom: {
            sensitivity: PxlsAppSetting<number>;
            limit: {
                minimum: PxlsAppSetting<number>;
                maximum: PxlsAppSetting<number>;
            };
            rounding: {
                enable: PxlsAppSetting<boolean>;
            };
        };
        template: {
            beneathoverlays: PxlsAppSetting<boolean>;
            opacity: PxlsAppSetting<number>;
            style: {
                source: PxlsAppSetting<PxlsAppSettingType>;
                customSource: PxlsAppSetting<string>;
            };
        };
        snapshot: {
            format: PxlsAppSetting<PxlsAppSettingType>;
        };
    };
    place: {
        notification: {
            enable: PxlsAppSetting<boolean>;
        };
        deselectonplace: {
            enable: PxlsAppSetting<boolean>;
        };
        palette: {
            scrolling: {
                enable: PxlsAppSetting<boolean>;
                invert: PxlsAppSetting<boolean>;
            };
        };
        picker: {
            enable: PxlsAppSetting<boolean>;
        };
        rightclick: {
            action: PxlsAppSetting<PxlsAppSettingType>;
        };
        alert: {
            delay: PxlsAppSetting<number>;
        };
    };
    lookup: {
        filter: {
            sensitive: {
                enable: PxlsAppSetting<boolean>;
            };
        };
    };
    chat: {
        enable: PxlsAppSetting<boolean>;
        timestamps: {
            '24h': PxlsAppSetting<boolean>;
        };
        badges: {
            enable: PxlsAppSetting<boolean>;
        };
        factiontags: {
            enable: PxlsAppSetting<boolean>;
        };
        pings: {
            enable: PxlsAppSetting<boolean>;
            audio: {
                when: PxlsAppSetting<PxlsAppSettingType>;
                volume: PxlsAppSetting<number>;
            };
        };
        links: {
            templates: {
                preferurls: PxlsAppSetting<boolean>;
            };
            internal: {
                behavior: PxlsAppSetting<PxlsAppSettingType>;
            };
            external: {
                skip: PxlsAppSetting<boolean>;
            };
        };
        font: {
            size: PxlsAppSetting<number>;
        };
        truncate: {
            max: PxlsAppSetting<number>;
        };
    };
    fix: {
        chrome: {
            offset: {
                enable: PxlsAppSetting<boolean>;
            };
        };
    };
}

export interface PxlsSocketModule {
    init: () => void;
    on: (event: string, callback: (data: unknown) => void) => void;
    send: (data: unknown) => void;
    close: () => void;
    reconnect: () => void;
    reconnectSocket: () => void;
}

export interface PxlsStorageModule {
    haveSupport: boolean | null;
    support: () => boolean;
    get: (key: string) => unknown;
    has: (key: string) => boolean;
    set: (key: string, value: unknown) => void;
    remove: (key: string) => void;
}

export interface PxlsTemplateModule {
    normalizeTemplateObj: {
        (obj: PxlsAppTemplateUrlObject, dir?: true): PxlsAppTemplateObject;
        (obj: PxlsAppTemplateObject, dir: false): PxlsAppTemplateUrlObject;
    };
    update: (options: PxlsAppTemplateObject, updateSettings?: boolean) => void;
    draw: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
    init: () => void;
    webinit: (data: PxlsInfoResponse) => void;
    queueUpdate: (templateObj: NullishKeys<PxlsAppTemplateObject>) => void;
    getOptions: () => PxlsAppTemplateObject;
    setPixelated: (pixelate?: boolean) => void;
    getDisplayWidth: () => number;
    getDisplayHeight: () => number;
    getWidthRatio: () => number;
}

export interface PxlsUiHelperModule {
    init: () => void;
    initBanner: (textList: string[]) => void;
    updateAvailable: (count: number, cause: string) => void;
    getAvailable: () => number;
    setPlaceableText: (placeable: number) => void;
    setMax: (maxStacked: number) => void;
    setDiscordName: (name: string) => void;
    updateAudio: (url?: string) => void;
    styleElemWithChatNameColor: (elem: HTMLElement, colorIdx: number, layer: 'bg' | 'color') => void;
    setBannerEnabled: (enabled?: boolean) => void;
    readonly initTitle: string;
    getTitle: (prepend: unknown) => string;
    setLoadingBubbleState: (process: unknown, state: unknown) => void;
    makeMarkdownProcessor: (whitelist: unknown) => unknown;
    toggleCaptchaLoading: (display?: boolean) => void;
    readonly tabId: number | null;
    tabHasFocus: () => boolean;
    prettifyRange: (ranges: string) => void;
    handleFile: (dataTransfer: DataTransfer) => void;
}

export interface PxlsUserModule {
    init: (instaban: boolean) => void;
    getRoles: () => string[];
    isStaff: () => boolean;
    isDonator: () => boolean;
    getPermissions: () => string[];
    hasPermission: (permission: string) => boolean;
    getUsername: () => string;
    getPixelCount: () => number;
    getPixelCountAllTime: () => number;
    webinit: (data: PxlsInfoResponse) => void;
    wsinit: () => void;
    isLoggedIn: () => boolean;
    renameRequested: boolean | undefined;
    showRenameRequest: () => void;
    hideRenameRequest: () => void;
    getChatNameColor: () => number;
    setChatNameColor: (color: number) => void;
    readonly admin: boolean;
    readonly placementOverrides: boolean;
}

export interface PxlsAppChatHookData {
    id: number;
    author: string;
    date: number;
    message_raw: string;
    replyingToId: number;
    replyShouldMention: boolean;
    badges: {
        displayName: string;
        tooltip: string;
        type: string;
        cssIcon: string;
    }[];
    authorNameColor: number;
}

export interface PxlsAppChatHook {
    id: string;
    get(data: PxlsAppChatHookData): { pings: string[] };
}

export interface PxlsAppLookupHookData {
    id: number;
    x: number;
    y: number;
    time: number;
    username?: string;
    faction?: string;
    origin?: string;
    pixelCount?: number;
    pixelCountAlltime?: number;
    discordName?: string;
}

export interface PxlsAppLookupHook {
    id: string;
    name: string;
    sensitive: boolean;
    backgroundCompatible: boolean;
    get: (data: PxlsAppLookupHookData) => string | Node | null | undefined;
    css: Record<string, string>;
}

export interface PxlsAppOverlay {
    readonly name: string;
    readonly isShown: boolean;
    setPixel: (x: number, y: number, color: string) => void;
    getImageData: () => ImageData;
    setImageData: (data: ImageData) => void;
    clear: () => void;
    setOpacity: (opacity: number) => void;
    show: () => void;
    hide: () => void;
    toggle: () => void;
    setShown: (shown: boolean) => void;
    remove: () => void;
    reload: () => void;
    setPixelated: (pixelated?: boolean) => void;
}

export type PxlsAppSettingType = boolean | number | string;

export interface PxlsAppSetting<SettingType extends PxlsAppSettingType> {
    get: () => SettingType;
    set: (value: SettingType) => void;
    reset: () => void;
    listen: (fn: () => void) => void;
    unlisten: (fn: () => void) => void;
    controls: {
        add: (control: JQuery | HTMLElement) => void;
        remove: (control: JQuery | HTMLElement) => void;
        disable: () => void;
        enable: () => void;
    };
    toggle: () => void;
}

export type PxlsAppTemplateConvertMode = 'unconverted' | 'nearestCustom';

export interface PxlsAppTemplateObject {
    use?: boolean;
    width: number;
    x: number;
    y: number;
    url: string;
    title: string;
    convertMode: PxlsAppTemplateConvertMode;
    // todo: add possible values
    style?: string;
}

export interface PxlsAppTemplateUrlObject {
    tw: number;
    ox: number;
    oy: number;
    template: string;
    title: string;
    convert: PxlsAppTemplateConvertMode;
}
