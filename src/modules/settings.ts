import type { GenericSchema, InferOutput } from 'valibot';
import * as v from 'valibot';
import type { NonNullableKeys } from '../util/types';
import { showErrorMessage } from './message';

export type ValueSerializer<T> = (value: T) => unknown;
export type ValueSerializerMap<T extends Record<string, unknown>> = {
    [K in keyof T]: ValueSerializer<T[K]>;
};

export const booleanSerializer: ValueSerializer<boolean> = (value) => value;
export const numberSerializer: ValueSerializer<number> = (value) => value;
export const stringSerializer: ValueSerializer<string> = (value) => value;
export const numberArraySerializer: ValueSerializer<number[]> = (values) =>
    values.map((value) => value.toString(10)).join(',');

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

export class Settings<const TSettings extends Record<string, unknown>> {
    constructor(
        private readonly storageKey: string,
        private readonly schema: GenericSchema<unknown, Partial<TSettings>>,
        private readonly defaultValue: TSettings,
        private readonly valueSerializerMap: ValueSerializerMap<TSettings>,
    ) {
        this.init();
    }

    get<K extends keyof TSettings>(option: K): TSettings[K] {
        const storedValue = this.loadFullStoredValue();
        return storedValue[option];
    }

    set<K extends keyof TSettings>(option: K, value: TSettings[K]): void {
        const storedValue = this.loadFullStoredValue();
        const newValue = { ...storedValue, [option]: value };
        this.saveStoredValue(newValue);
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
            const serializer = this.valueSerializerMap[key];
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
            storedValue[key] = serializer(value) as TSettings[keyof TSettings];
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
const globalSettingsValueSerializerMap: ValueSerializerMap<GlobalSettingsObject> = {
    debug: booleanSerializer,
    settingsUiCollapsed: booleanSerializer,
};

export function initGlobalSettings(storageKey: string): void {
    if (GLOBAL_SETTINGS != null) {
        return;
    }

    GLOBAL_SETTINGS = new Settings(
        storageKey,
        globalSettingsSchema,
        globalSettingsDefault,
        globalSettingsValueSerializerMap,
    );
}

export function getGlobalSettings(): NonNullable<typeof GLOBAL_SETTINGS> {
    if (GLOBAL_SETTINGS == null) {
        throw new Error('Global settings not initialized');
    }
    return GLOBAL_SETTINGS;
}

export function createScriptSettings<const TSettings extends Record<string, unknown>>(
    storageKey: string,
    schema: GenericSchema<unknown, Partial<TSettings>>,
    defaultValue: TSettings,
    valueSerializerMap: ValueSerializerMap<TSettings>,
): Settings<TSettings> {
    return new Settings(storageKey, schema, defaultValue, valueSerializerMap);
}
