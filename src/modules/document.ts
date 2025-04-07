export function createDocumentFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

export function createRandomElementId(): string {
    return `dpus-${crypto.randomUUID()}`;
}
