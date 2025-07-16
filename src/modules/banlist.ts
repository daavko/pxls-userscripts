import * as v from 'valibot';
import { hashString } from './hash';

const banListSchema = v.array(v.string());

async function fetchBanList(): Promise<string[]> {
    const banListResponse = await fetch('https://pxls.daavko.moe/userscripts/banlist.json');

    if (!banListResponse.ok) {
        throw new Error(`Failed to fetch banlist: ${banListResponse.statusText}`);
    }

    const banListData: unknown = await banListResponse.json();
    const banListParseResult = v.safeParse(banListSchema, banListData);
    if (banListParseResult.success) {
        return banListParseResult.output;
    } else {
        throw new Error('Failed to parse banlist response', { cause: banListParseResult.issues });
    }
}

export async function isUserBanned(username: string): Promise<boolean> {
    const hash = await hashString(username);
    const banList = await fetchBanList();
    return banList.includes(hash);
}
