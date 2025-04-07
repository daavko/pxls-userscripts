import { ZodError } from 'zod';
import { type PxlsInfoResponse, pxlsInfoResponseSchema } from '../pxls/pxls-types';
import { showErrorMessage } from './message';

declare global {
    interface Window {
        dpusPxlsInfo?: InfoFetchState;
    }
}

interface PendingInfoFetch {
    state: 'pending';
    promise: Promise<PxlsInfoResponse | null>;
}

interface FinishedInfoFetch {
    state: 'finished';
    data: PxlsInfoResponse;
}

type InfoFetchState = PendingInfoFetch | FinishedInfoFetch;

export async function getPxlsInfo(): Promise<PxlsInfoResponse | null> {
    if (window.dpusPxlsInfo) {
        if (window.dpusPxlsInfo.state === 'pending') {
            return window.dpusPxlsInfo.promise;
        } else if (window.dpusPxlsInfo.state === 'finished') {
            return window.dpusPxlsInfo.data;
        }
    }

    window.dpusPxlsInfo = {
        state: 'pending',
        promise: fetchInfo().catch((error: unknown) => {
            if (error instanceof ZodError) {
                showErrorMessage(`Failed to parse /info response: ${error.message}`);
                console.error('Failed to parse /info response', error);
            } else if (error instanceof Error) {
                showErrorMessage(`Failed to fetch /info: ${error.message}`);
                console.error('Failed to fetch /info', error);
            }
            return null;
        }),
    };
    return window.dpusPxlsInfo.promise;
}

async function fetchInfo(): Promise<PxlsInfoResponse> {
    const infoResponse = await fetch('/info');

    if (!infoResponse.ok) {
        throw new Error(`Failed to fetch /info: ${infoResponse.statusText}`);
    }

    const infoData: unknown = await infoResponse.json();
    const infoDataParseResult = pxlsInfoResponseSchema.safeParse(infoData);

    if (!infoDataParseResult.success) {
        throw new Error('Failed to parse /info response', { cause: infoDataParseResult.error });
    }

    return infoDataParseResult.data;
}
