export async function waitForAnimationFrame(): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>();
    requestAnimationFrame(() => {
        resolve();
    });
    return promise;
}
