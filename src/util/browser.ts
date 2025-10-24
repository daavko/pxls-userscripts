export async function waitForAnimationFrame(): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => {
        resolve();
    });
    return promise;
}

export function queueMacrotask(task: () => void): void {
    const channel = new MessageChannel();
    channel.port1.onmessage = (): void => {
        task();
    };
    channel.port2.postMessage(undefined);
}

export async function waitForMacrotask(): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    queueMacrotask(() => {
        resolve();
    });
    return promise;
}
