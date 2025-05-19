export type NonNullableKeys<T> = {
    [K in keyof T]-?: NonNullable<T[K]>;
};

// makes every key in T nullable
export type NullableKeys<T> = {
    [K in keyof T]: T[K] | null;
};

export type NullishKeys<T> = {
    [K in keyof T]?: T[K] | null | undefined;
};
