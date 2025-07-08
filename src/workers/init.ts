import { isInitMessage } from './init.schemas';

export function bindInitEvent(): void {
    globalThis.addEventListener('message', ({ data }: MessageEvent<object>) => {
        if (!isInitMessage(data)) {
            return;
        }

        const { enableDebug } = data;
        DEBUG_ENABLED = enableDebug;
    });
}

let DEBUG_ENABLED: boolean | null = null;

export function getWorkerDebugEnabled(): boolean {
    if (DEBUG_ENABLED === null) {
        throw new Error('Debug enabled is not set. Send init message first.');
    }
    return DEBUG_ENABLED;
}
