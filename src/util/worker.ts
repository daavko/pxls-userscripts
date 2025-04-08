import { debug, debugTime } from '../modules/debug';

// @ts-expect-error -- safe, never actually called
// eslint-disable-next-line @typescript-eslint/no-empty-function -- never actually called
export const workerDebugEnabled = (): boolean => {};

// @ts-expect-error -- safe, never actually called
// eslint-disable-next-line @typescript-eslint/no-empty-function -- never actually called
export const workerDebugName = (): string => {};

export const workerDebug = (message: string): void => {
    if (workerDebugEnabled()) {
        console.debug(`[${workerDebugName()}]`, message);
    }
};

interface WorkerDebugTimer {
    stop(): void;
}

export const workerDebugTime = (timerName: string): WorkerDebugTimer | null => {
    const timerNameWithId = `${timerName} (${globalThis.crypto.randomUUID()})`;
    const fullTimingName = `[${workerDebugName()}] ${timerNameWithId}`;
    if (workerDebugEnabled()) {
        workerDebug(`${timerNameWithId} timer started`);
        console.time(fullTimingName);
        return {
            stop: (): void => {
                console.timeEnd(fullTimingName);
            },
        };
    } else {
        return null;
    }
};

export function createWorkerDebugShim(workerName: string): string {
    return `
let debugEnabled = false;
let ${workerDebugEnabled.name} = () => debugEnabled;
let ${workerDebugName.name} = () => '${workerName}';
const ${debug.name} = ${workerDebug.toString()};
const ${workerDebug.name} = ${debug.name};
const ${debugTime.name} = ${workerDebugTime.toString()}`;
}

export function createSetDebugEnabledShim(): string {
    return `debugEnabled = e.data.debugEnabled ?? false;`;
}
