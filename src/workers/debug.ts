import { getWorkerDebugEnabled, getWorkerScriptName } from './init';

function debugName(): string {
    return `[${getWorkerScriptName()}]`;
}

export function workerDebug(message: string, ...data: unknown[]): void {
    if (getWorkerDebugEnabled()) {
        console.debug(debugName(), message, ...data);
    }
}

export interface WorkerDebugTimer {
    stop(): void;
    mark(message: string): void;
}

export function workerDebugTime(timerName: string): WorkerDebugTimer | null {
    const timerNameWithId = `${timerName} (${globalThis.crypto.randomUUID()})`;
    const fullTimingName = `${debugName()} ${timerNameWithId}`;
    if (getWorkerDebugEnabled()) {
        workerDebug(`${timerNameWithId} timer started`);
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
