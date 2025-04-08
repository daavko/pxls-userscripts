import { getGlobalSettings } from './settings';

let DEBUG_NAME = '[missing name]';

export function setDebugName(name: string): void {
    DEBUG_NAME = `[${name}]`;
}

export function debugEnabled(): boolean {
    return getGlobalSettings().get('debug');
}

export function debug(message: string, ...data: unknown[]): void {
    if (debugEnabled()) {
        console.debug(DEBUG_NAME, message, ...data);
    }
}

export interface DebugTimer {
    stop(): void;
}

export function debugTime(timerName: string): DebugTimer | null {
    const timerNameWithId = `${timerName} (${window.crypto.randomUUID()})`;
    const fullTimingName = `${DEBUG_NAME} ${timerNameWithId}`;
    if (debugEnabled()) {
        debug(`${timerNameWithId} timer started`);
        console.time(fullTimingName);
        return {
            stop: (): void => {
                console.timeEnd(fullTimingName);
            },
        };
    } else {
        return null;
    }
}
