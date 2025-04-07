import { getGlobalSettings } from './settings';

let DEBUG_NAME = '[missing name]';

export function setDebugName(name: string): void {
    DEBUG_NAME = `[${name}]`;
}

export function debug(message: string): void {
    if (getGlobalSettings().get('debug')) {
        console.debug(DEBUG_NAME, message);
    }
}

export interface DebugTimer {
    stop(): void;
}

export function debugTime(timingName: string): DebugTimer | null {
    const fullTimingName = `${DEBUG_NAME} ${timingName}`;
    if (getGlobalSettings().get('debug')) {
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
