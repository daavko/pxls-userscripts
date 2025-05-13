import { isInitMessage } from './init.schemas';

export function bindInitEvent(): void {
    globalThis.addEventListener('message', ({ data }: MessageEvent<object>) => {
        if (!isInitMessage(data)) {
            return;
        }

        const { enableDebug, scriptName } = data;
        DEBUG_ENABLED = enableDebug;
        WORKER_SCRIPT_NAME = scriptName;
    });
}

let DEBUG_ENABLED: boolean | null = null;
let WORKER_SCRIPT_NAME: string | null = null;

export function getWorkerDebugEnabled(): boolean {
    if (DEBUG_ENABLED === null) {
        throw new Error('Debug enabled is not set. Send init message first.');
    }
    return DEBUG_ENABLED;
}

export function getWorkerScriptName(): string {
    if (WORKER_SCRIPT_NAME === null) {
        throw new Error('Worker script name is not set. Send init message first.');
    }
    return WORKER_SCRIPT_NAME;
}
