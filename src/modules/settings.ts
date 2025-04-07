import { z } from 'zod';
import type { NonNullableKeys } from '../util/types';

type ValidSettingsValue = string | number | boolean;
export type SettingsRecord = Record<string, ValidSettingsValue>;

export interface Settings<T extends SettingsRecord> {
    get(option: keyof T): T[typeof option];
    set(option: keyof T, value: T[typeof option]): void;

    _assertBoolean(option: keyof T): void;
    _getBoolean(option: keyof T): boolean;
    _setBoolean(option: keyof T, value: boolean): void;

    reset(): void;
}

type SettingsSchema = z.ZodType<Record<string, ValidSettingsValue | undefined>>;
type PartialSettingsObject<T extends SettingsSchema> = z.output<T>;
type SettingsObject<T extends SettingsSchema> = NonNullableKeys<z.output<T>>;
type KeyofSettingsObject<T extends SettingsSchema> = keyof SettingsObject<T>;
type SettingsObjectPropertyValue<T extends SettingsSchema, K extends KeyofSettingsObject<T>> = SettingsObject<T>[K];

const SettingsImpl = class<SchemaType extends SettingsSchema> implements Settings<SettingsObject<SchemaType>> {
    constructor(
        private readonly storageKey: string,
        private readonly schema: SchemaType,
        private readonly defaultValue: SettingsObject<SchemaType>,
    ) {
        this.init();
    }

    get(option: KeyofSettingsObject<SchemaType>): SettingsObjectPropertyValue<SchemaType, typeof option> {
        const storedValue = this.getFullStoredObjectValue();
        return storedValue[option];
    }

    set(option: KeyofSettingsObject<SchemaType>, value: SettingsObjectPropertyValue<SchemaType, typeof option>): void {
        const storedValue = this.getFullStoredObjectValue();
        const newValue: SettingsObject<SchemaType> = { ...storedValue, [option]: value };
        this.setStoredObjectValue(newValue);
    }

    reset(): void {
        this.setStoredObjectValue(this.defaultValue);
    }

    _assertBoolean(option: keyof SettingsObject<SchemaType>): void {
        const storedValue = this.getFullStoredObjectValue();
        if (typeof storedValue[option] !== 'boolean') {
            throw new Error(`Setting ${this.storageKey}.${String(option)} is not a boolean`);
        }
    }

    _getBoolean(option: keyof SettingsObject<SchemaType>): boolean {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        return this.get(option) as boolean;
    }

    _setBoolean(option: keyof SettingsObject<SchemaType>, value: boolean): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        this.set(option, value as Parameters<typeof this.set>[1]);
    }

    private init(): void {
        const storedValue = this.getPartialStoredObjectValue();
        if (storedValue == null) {
            this.setStoredObjectValue(this.defaultValue);
        } else {
            this.setStoredObjectValue({ ...this.defaultValue, ...storedValue });
        }
    }

    private getFullStoredObjectValue(): SettingsObject<SchemaType> {
        const storedValue = this.getPartialStoredObjectValue();
        if (storedValue == null) {
            return this.defaultValue;
        }
        return { ...this.defaultValue, ...storedValue };
    }

    private getPartialStoredObjectValue(): PartialSettingsObject<SchemaType> | null {
        const storedValue = localStorage.getItem(this.storageKey);
        if (storedValue == null) {
            return null;
        }

        let parsedJson: unknown;
        try {
            parsedJson = JSON.parse(storedValue);
        } catch (e) {
            console.warn(`Failed to parse stored settings for ${this.storageKey}:`, e);
            return null;
        }

        const parsedValue = this.schema.safeParse(parsedJson);
        if (parsedValue.success) {
            return parsedValue.data;
        } else {
            return null;
        }
    }

    private setStoredObjectValue(value: SettingsObject<SchemaType>): void {
        localStorage.setItem(this.storageKey, JSON.stringify(value));
    }
};

let GLOBAL_SETTINGS: Settings<GlobalSettingsObject> | null = null;

const globalSettingsSchema = z
    .object({
        debug: z.boolean(),
        settingsUiCollapsed: z.boolean(),
    })
    .partial();
type GlobalSettingsObject = Required<z.infer<typeof globalSettingsSchema>>;
const globalSettingsDefault: GlobalSettingsObject = {
    debug: false,
    settingsUiCollapsed: false,
};

export function initGlobalSettings(storageKey: string): void {
    if (GLOBAL_SETTINGS != null) {
        return;
    }

    GLOBAL_SETTINGS = new SettingsImpl(storageKey, globalSettingsSchema, globalSettingsDefault);
}

export function getGlobalSettings(): Settings<GlobalSettingsObject> {
    if (GLOBAL_SETTINGS == null) {
        throw new Error('Global settings not initialized');
    }
    return GLOBAL_SETTINGS;
}

export function createScriptSettings<SchemaType extends SettingsSchema>(
    storageKey: string,
    schema: SchemaType,
    defaultValue: SettingsObject<SchemaType>,
): Settings<SettingsObject<SchemaType>> {
    return new SettingsImpl(storageKey, schema, defaultValue);
}
