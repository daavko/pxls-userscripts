export type NonNullableKeys<T> = {
    [K in keyof T]-?: NonNullable<T[K]>;
};
