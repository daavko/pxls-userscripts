export async function hash(input: BufferSource): Promise<string> {
    const hashArray = await crypto.subtle.digest('SHA-256', input);
    return Array.from(new Uint8Array(hashArray))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export async function hashString(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const inputBuffer = encoder.encode(input);
    return hash(inputBuffer);
}
