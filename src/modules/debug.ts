import { getScriptName } from './pxls-init';
import { getGlobalSettings } from './settings';

function debugName(): string {
    return `[${getScriptName()}]`;
}

export function debugEnabled(): boolean {
    return getGlobalSettings().get('debug');
}

export function debug(message: string, ...data: unknown[]): void {
    if (debugEnabled()) {
        console.debug(debugName(), message, ...data);
    }
}

export interface DebugTimer {
    stop(): void;
    mark(message: string): void;
}

export function debugTime(timerName: string): DebugTimer | null {
    const timerNameWithId = `${timerName} (${window.crypto.randomUUID()})`;
    const fullTimingName = `${debugName()} ${timerNameWithId}`;
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
