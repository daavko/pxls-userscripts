import type { PxlsInfoResponse } from './pxls-types';

declare interface PxlsApp {
    ls: PxlsAppStorage;

    ss: PxlsAppStorage;

    settings: {
        filter: {
            search(query: string): void;
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
    };

    query: {
        init(): void;
        get(key: string): string | undefined;
        set(key: string, value: string, silent?: boolean): void;
        set(obj: Record<string, string>, silent?: boolean): void;
        has(key: string): boolean;
        update(): void;
        remove(key: string, silent?: boolean): void;
        lazy_update(): void;
    };

    overlays: {
        add(
            name: string,
            fetchData: () => Promise<void>,
            onLazyInit: (width: number, height: number, previouslyLazyInited: number) => void,
        ): PxlsAppOverlay;
        remove(name: string): void;
        // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
        readonly heatmap: {
            clear(): void;
            reload(): void;
        };
        // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
        readonly heatbackground: {
            reload(): void;
        };
        // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
        readonly virginmap: {
            clear(): void;
            reload(): void;
        };
        // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
        readonly virginbackground: {
            reload(): void;
        };
    };

    uiHelper: {
        readonly tabId: number | null;
        tabHasFocus(): boolean;
        updateAudio(url?: string): void;
        handleFile(dataTransfer: DataTransfer): void;
    };

    template: {
        update(templateObj: PxlsAppTemplateObject): void;
        normalize(obj: PxlsAppTemplateUrlObject, dir?: true): PxlsAppTemplateObject;
        normalize(obj: PxlsAppTemplateObject, dir: false): PxlsAppTemplateUrlObject;
    };

    lookup: {
        registerHook(...hooks: PxlsAppLookupHook[]): void;
        replaceHook(hookId: string, newHook: Omit<PxlsAppLookupHook, 'id'>): void;
        unregisterHook(hookId: string): void;
    };

    centerBoardOn(x: number, y: number): void;

    updateTemplate(): void;

    alert(message: string): void;

    // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
    chat: {
        init(): Promise<void>;
        webinit(data: PxlsInfoResponse): Promise<void>;
        _handleActionClick(e: MouseEvent): void;
        clearPings(): void;
        setCharLimit(limit: number): void;
        processMessage(message: string, mentionCallback: () => void): string;
        saveIgnores(): void;
        reloadIgnores(): void;
        addIgnore(name: string): void;
        removeIgnore(name: string): void;
        getIgnores(): string[];
        // todo
        typeahead: {};
        updateSelectedNameColor(colorIndex: number): void;
        updateCanvasBanState(banned: boolean): void;
        // todo
        registerHook: {};
        // todo
        replaceHook: {};
        // todo
        unregisterHook: {};
        // todo
        runLookup: {};
        // todo
        readonly markdownProcessor: {};
        // todo
        readonly canvasBanRespected: {};
    };

    // todo
    // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
    typeahead: {};

    // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
    user: {
        getUsername(): string;
        getPixelCount(): number;
        getPixelCountAllTime(): number;
        getRoles(): string[];
        isLoggedIn(): boolean;
        isStaff(): boolean;
        isDonator(): boolean;
        getPermissions(): string[];
        hasPermission(permission: string): boolean;
    };

    // todo
    // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
    modal: {};
}

declare interface PxlsAppStorage {
    haveSupport: boolean | null;
    support(): boolean;
    get(key: string): unknown;
    has(key: string): boolean;
    set(key: string, value: unknown): void;
    remove(key: string): void;
}

declare type PxlsAppSettingType = boolean | number | string;

declare interface PxlsAppSetting<SettingType extends PxlsAppSettingType> {
    get(): SettingType;
    set(value: SettingType): void;
    reset(): void;
    listen(fn: () => void): void;
    unlisten(fn: () => void): void;
    // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
    controls: {
        add(): void;
        remove(): void;
        disable(): void;
        enable(): void;
    };
}

declare interface PxlsAppOverlay {
    readonly name: string;
    readonly isShown: boolean;
    setPixel(x: number, y: number, color: string): void;
    getImageData(): ImageData;
    setImageData(data: ImageData): void;
    clear(): void;
    setOpacity(opacity: number): void;
    show(): void;
    hide(): void;
    toggle(): void;
    setShown(shown: boolean): void;
    remove(): void;
    reload(): void;
    setPixelated(pixelated?: boolean): void;
}

declare type PxlsAppTemplateConvertMode = 'unconverted' | 'nearestCustom';

declare interface PxlsAppTemplateObject {
    width: number;
    x: number;
    y: number;
    url: string;
    title: string;
    convertMode: PxlsAppTemplateConvertMode;
    // todo: add possible values
    style?: string;
}

declare interface PxlsAppTemplateUrlObject {
    tw: number;
    ox: number;
    oy: number;
    template: string;
    title: string;
    convert: PxlsAppTemplateConvertMode;
}

declare interface PxlsAppLookupHook {
    id: string;
    name: string;
    sensitive: boolean;
    backgroundCompatible: boolean;
    get(data: PxlsAppLookupHookData): string | Node | null | undefined;
    // eslint-disable-next-line @typescript-eslint/member-ordering -- foreign code
    css: Record<string, string>;
}

declare interface PxlsAppLookupHookData {
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

declare global {
    interface Window {
        App?: PxlsApp;
    }
}
