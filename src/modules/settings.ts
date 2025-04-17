import type { GenericSchema, InferOutput } from 'valibot';
import * as v from 'valibot';
import type { NonNullableKeys } from '../util/types';
import { showErrorMessage } from './message';
import { getScriptId } from './pxls-init';

export type BooleanOption<T extends Record<string, unknown>, K extends keyof T> = T[K] extends boolean ? T[K] : never;
export type NumberOption<T extends Record<string, unknown>, K extends keyof T> = T[K] extends number ? T[K] : never;
export type StringOption<T extends Record<string, unknown>, K extends keyof T> = T[K] extends string ? T[K] : never;

export type BooleanOptionKeys<T extends Record<string, unknown>> = {
    [K in keyof T]: T[K] extends boolean ? K : never;
}[keyof T];
export type NumberOptionKeys<T extends Record<string, unknown>> = {
    [K in keyof T]: T[K] extends number ? K : never;
}[keyof T];
export type StringOptionKeys<T extends Record<string, unknown>> = {
    [K in keyof T]: T[K] extends string ? K : never;
}[keyof T];

export type OptionValueUpdateCallbackMap<T extends Record<string, unknown>> = {
    [K in keyof T]: (oldValue: T[K], newValue: T[K]) => void;
};

export class Settings<const TSettings extends Record<string, unknown>> {
    constructor(
        private readonly storageKey: string,
        private readonly schema: GenericSchema<unknown, Partial<TSettings>>,
        private readonly defaultValue: TSettings,
        private readonly optionValueUpdateCallbacks: Partial<OptionValueUpdateCallbackMap<TSettings>> = {},
    ) {
        this.init();
    }

    get<K extends keyof TSettings>(option: K): TSettings[K] {
        const storedValue = this.loadFullStoredValue();
        return storedValue[option];
    }

    set<K extends keyof TSettings>(option: K, value: TSettings[K]): void {
        const storedValue = this.loadFullStoredValue();
        const oldSettingValue = storedValue[option];
        const newValue = { ...storedValue, [option]: value };
        this.saveStoredValue(newValue);
        const callback = this.optionValueUpdateCallbacks[option];
        if (callback) {
            callback(oldSettingValue, value);
        }
    }

    _getBoolean<K extends keyof TSettings>(option: K): BooleanOption<TSettings, K> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        return this.get(option) as BooleanOption<TSettings, K>;
    }

    _setBoolean<K extends BooleanOptionKeys<TSettings>>(option: K, value: boolean): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        this.set(option, value as TSettings[K]);
    }

    _getNumber<K extends keyof TSettings>(option: K): NumberOption<TSettings, K> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        return this.get(option) as NumberOption<TSettings, K>;
    }

    _setNumber<K extends NumberOptionKeys<TSettings>>(option: K, value: number): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        this.set(option, value as TSettings[K]);
    }

    _getString<K extends keyof TSettings>(option: K): StringOption<TSettings, K> {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        return this.get(option) as StringOption<TSettings, K>;
    }

    _setString<K extends StringOptionKeys<TSettings>>(option: K, value: string): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        this.set(option, value as TSettings[K]);
    }

    reset(): void {
        this.saveStoredValue(this.defaultValue);
    }

    private init(): void {
        const storedValue = this.loadStoredValue();
        this.saveStoredValue({ ...this.defaultValue, ...storedValue });
    }

    private loadFullStoredValue(): TSettings {
        const storedValue = this.loadStoredValue();
        if (storedValue == null) {
            return this.defaultValue;
        }
        return { ...this.defaultValue, ...storedValue };
    }

    private loadStoredValue(): Partial<TSettings> {
        const storedValue = localStorage.getItem(this.storageKey);
        if (storedValue == null) {
            return {};
        }

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(storedValue);
        } catch (e) {
            console.error(e);
            showErrorMessage(`Failed to parse stored settings for ${this.storageKey}`);
            return {};
        }

        const parsedValue = v.safeParse(this.schema, parsedJson);
        if (parsedValue.success) {
            return parsedValue.output;
        } else {
            const errorMessage = `Stored settings for ${this.storageKey} are invalid`;
            showErrorMessage(errorMessage, new Error(errorMessage, { cause: parsedValue.issues }));
            return {};
        }
    }

    private saveStoredValue(valueToStore: Partial<TSettings>): void {
        const storedValue = this.loadFullStoredValue();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        for (const [key, value] of Object.entries(valueToStore) as [keyof TSettings, TSettings[keyof TSettings]][]) {
            storedValue[key] = value;
        }
        localStorage.setItem(this.storageKey, JSON.stringify(storedValue));
    }
}

let GLOBAL_SETTINGS: Settings<GlobalSettingsObject> | null = null;

const globalSettingsSchema = v.partial(
    v.object({
        debug: v.boolean(),
        settingsUiCollapsed: v.boolean(),
    }),
);
type GlobalSettingsObject = NonNullableKeys<InferOutput<typeof globalSettingsSchema>>;
const globalSettingsDefault: GlobalSettingsObject = {
    debug: false,
    settingsUiCollapsed: false,
};

export function initGlobalSettings(): void {
    if (GLOBAL_SETTINGS != null) {
        return;
    }

    const storageKey = `dpus_${getScriptId()}_globalSettings`;
    GLOBAL_SETTINGS = new Settings(storageKey, globalSettingsSchema, globalSettingsDefault);
}

export function getGlobalSettings(): NonNullable<typeof GLOBAL_SETTINGS> {
    if (GLOBAL_SETTINGS == null) {
        throw new Error('Global settings not initialized');
    }
    return GLOBAL_SETTINGS;
}

export function createScriptSettings<const TSettings extends Record<string, unknown>>(
    schema: GenericSchema<unknown, Partial<TSettings>>,
    defaultValue: TSettings,
    optionValueUpdateCallbacks?: Partial<OptionValueUpdateCallbackMap<TSettings>>,
): Settings<TSettings> {
    const storageKey = `dpus_${getScriptId()}_settings`;
    return new Settings(storageKey, schema, defaultValue, optionValueUpdateCallbacks);
}
