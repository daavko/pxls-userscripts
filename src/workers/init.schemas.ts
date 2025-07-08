export interface InitMessage {
    type: 'init';
    enableDebug: boolean;
}

export function isInitMessage(data: object): data is InitMessage {
    return Reflect.get(data, 'type') === 'init';
}
