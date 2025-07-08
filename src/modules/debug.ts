import { GLOBAL_SETTINGS } from './settings';

export function debugEnabled(): boolean {
    return GLOBAL_SETTINGS.debug.get();
}

export function debug(message: string, ...data: unknown[]): void {
    if (debugEnabled()) {
        console.debug('[DPUS]', message, ...data);
    }
}

export interface DebugTimer {
    stop(): void;
    mark(message: string): void;
}

export function debugTime(timerName: string): DebugTimer | null {
    const timerNameWithId = `${timerName} (${window.crypto.randomUUID()})`;
    const fullTimingName = `[DPUS] ${timerNameWithId}`;
    if (debugEnabled()) {
        debug(`${timerNameWithId} timer started`);
        console.time(fullTimingName);
        return {
            stop: (): void => {
                console.timeEnd(fullTimingName);
            },
            mark: (msg): void => {
                console.timeLog(fullTimingName, msg);
            },
        };
    } else {
        return null;
    }
}
