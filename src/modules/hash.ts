import { debugTime } from './debug';

export async function hash(input: BufferSource): Promise<string> {
    const hashDebugTimer = debugTime('hash');
    const hashArray = await crypto.subtle.digest('SHA-256', input);
    const hashHex = Array.from(new Uint8Array(hashArray))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    hashDebugTimer?.stop();
    return hashHex;
}

export async function hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const inputBuffer = encoder.encode(input);
    return hash(inputBuffer);
}
