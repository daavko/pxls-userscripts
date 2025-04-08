import { createSetDebugEnabledShim, createWorkerDebugShim } from '../util/worker';
import { debugEnabled, debugTime } from './debug';

const HASH_WORKER_SCRIPT = `
${createWorkerDebugShim('hashWorker')}

self.onmessage = (e) => {
    const { input } = e.data;
    ${createSetDebugEnabledShim()}
    self.crypto.subtle.digest('SHA-1', input).then((hashBuffer) => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        self.postMessage({ type: 'success', hash: hashHex });
    }).catch((error) => {
        console.error('Error in worker:', error);
        self.postMessage({ type: 'error', error });
    });
}
`;

interface HashWorkerErrorResult {
    type: 'error';
    error: Error;
}

interface HashWorkerSuccessResult {
    type: 'success';
    hash: string;
}

type HashWorkerResult = HashWorkerErrorResult | HashWorkerSuccessResult;

export async function hashInWorker(input: BufferSource): Promise<string> {
    const hashDebugTimer = debugTime('hashWorker');
    const workerBlob = new Blob([HASH_WORKER_SCRIPT], { type: 'application/javascript' });
    const workerObjectURL = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerObjectURL);
    const resultPromise = new Promise<string>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<HashWorkerResult>): void => {
            switch (e.data.type) {
                case 'success':
                    resolve(e.data.hash ?? '');
                    break;
                case 'error':
                    reject(e.data.error);
                    break;
                default:
                    reject(new Error('Hash worker returned unknown result', { cause: e.data }));
            }
        };

        worker.onerror = (error: ErrorEvent): void => {
            reject(new Error('Unknown hash worker error', { cause: error }));
        };

        worker.postMessage({ input, debugEnabled: debugEnabled() });
    });
    void resultPromise.finally(() => {
        worker.terminate();
        URL.revokeObjectURL(workerObjectURL);
        hashDebugTimer?.stop();
    });
    return resultPromise;
}
