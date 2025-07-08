import * as v from 'valibot';
import { type PxlsInfoResponse, pxlsInfoResponseSchema } from '../pxls/pxls-types';
import { GLOBAL_MESSENGER } from './message';

let PXLS_INFO_FETCH: InfoFetchState | null = null;

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
    if (PXLS_INFO_FETCH) {
        switch (PXLS_INFO_FETCH.state) {
            case 'pending':
                return PXLS_INFO_FETCH.promise;
            case 'finished':
                return PXLS_INFO_FETCH.data;
        }
    }

    PXLS_INFO_FETCH = {
        state: 'pending',
        promise: fetchInfo().catch((error: unknown) => {
            if (error instanceof Error) {
                GLOBAL_MESSENGER.showErrorMessage(`Failed to fetch /info`, error);
            }
            return null;
        }),
    };
    return PXLS_INFO_FETCH.promise;
}

async function fetchInfo(): Promise<PxlsInfoResponse> {
    const infoResponse = await fetch('/info');

    if (!infoResponse.ok) {
        throw new Error(`Failed to fetch /info: ${infoResponse.statusText}`);
    }

    const infoData: unknown = await infoResponse.json();
    const infoDataParseResult = v.safeParse(pxlsInfoResponseSchema, infoData);

    if (!infoDataParseResult.success) {
        throw new Error('Failed to parse /info response', { cause: infoDataParseResult.issues });
    }

    return infoDataParseResult.output;
}
