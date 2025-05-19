export async function hash(input: BufferSource): Promise<string> {
    const hashArray = await crypto.subtle.digest('SHA-1', input);
    return Array.from(new Uint8Array(hashArray))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}
