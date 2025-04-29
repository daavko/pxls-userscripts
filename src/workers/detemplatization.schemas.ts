export interface DetemplatizeMessage {
    type: 'detemplatize';
    image: ImageData;
    targetWidth: number;
}

export function isDetemplatizeMessage(data: object): data is DetemplatizeMessage {
    return Reflect.get(data, 'type') === 'detemplatize';
}

export interface DetemplatizeErrorResult {
    type: 'detemplatizeResult';
    success: false;
    image?: undefined;
    error: Error;
}

export interface DetemplatizeSuccessResult {
    type: 'detemplatizeResult';
    success: true;
    image: ImageData;
    error?: undefined;
}

export type DetemplatizeResultMessage = DetemplatizeErrorResult | DetemplatizeSuccessResult;

export function isDetemplatizeResultMessage(data: object): data is DetemplatizeResultMessage {
    return Reflect.get(data, 'type') === 'detemplatizeResult';
}
