import { ZodError } from 'zod';
import { type PxlsInfoResponse, pxlsInfoResponseSchema } from '../pxls/pxls-types';
import { showErrorMessage } from './message';
import { getDpus } from './pxls-init';

declare global {
    interface DPUS {
        pxlsFetch: {
            info?: InfoFetchState;
        };
    }
}

function getDpusPxlsFetch(): DPUS['pxlsFetch'] {
    const dpus = getDpus();
    dpus.pxlsFetch ??= {};
    return dpus.pxlsFetch;
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
    const dpusPxlsFetch = getDpusPxlsFetch();
    if (dpusPxlsFetch.info) {
        if (dpusPxlsFetch.info.state === 'pending') {
            return dpusPxlsFetch.info.promise;
        } else if (dpusPxlsFetch.info.state === 'finished') {
            return dpusPxlsFetch.info.data;
        }
    }

    dpusPxlsFetch.info = {
        state: 'pending',
        promise: fetchInfo().catch((error: unknown) => {
            if (error instanceof ZodError) {
                showErrorMessage(`Failed to parse /info response`, error);
            } else if (error instanceof Error) {
                showErrorMessage(`Failed to fetch /info`, error);
            }
            return null;
        }),
    };
    return dpusPxlsFetch.info.promise;
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
