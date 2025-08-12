import * as v from 'valibot';
import { hashString } from './hash';

const INSTANCES_WITH_ALLOWLISTS = ['ab10500ac232304f4902cb31373514a9fda011da5eccc5c68751553385540825'];

const LIST_REQUESTS = new Map<string, string[]>();

const userListSchema = v.array(v.string());

async function fetchUserList(url: string): Promise<string[]> {
    const cachedRequest = LIST_REQUESTS.get(url);
    if (cachedRequest) {
        return cachedRequest;
    }

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch user list: ${response.statusText}`);
    }

    const userListData: unknown = await response.json();
    const userListParseResult = v.safeParse(userListSchema, userListData);
    if (userListParseResult.success) {
        LIST_REQUESTS.set(url, userListParseResult.output);
        return userListParseResult.output;
    } else {
        throw new Error('Failed to parse user list response', { cause: userListParseResult.issues });
    }
}

export async function instanceUsesAllowlists(): Promise<boolean> {
    const hash = await hashString(window.location.origin);
    return INSTANCES_WITH_ALLOWLISTS.includes(hash);
}

export async function isUserInList(username: string, url: string): Promise<boolean> {
    const hash = await hashString(username);
    const userList = await fetchUserList(url);
    return userList.includes(hash);
}
