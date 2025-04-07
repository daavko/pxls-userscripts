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
    const fullTimingName = `[${workerDebugName()}] ${timerName}`;
    if (workerDebugEnabled()) {
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
