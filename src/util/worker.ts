import { debugEnabled } from '../modules/debug';
import type { InitMessage } from '../workers/init.schemas';

export interface WorkerInstance {
    worker: Worker;
    terminate: () => void;
}

export function createWorker(workerCode: string): WorkerInstance {
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerObjectURL = URL.createObjectURL(workerBlob);
    const worker = new Worker(workerObjectURL);

    worker.postMessage({
        type: 'init',
        enableDebug: debugEnabled(),
    } satisfies InitMessage);

    const terminate = (): void => {
        worker.terminate();
        URL.revokeObjectURL(workerObjectURL);
    };

    return { worker, terminate };
}
