export function createDocumentFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

export function createStyleElement(css: string): DocumentFragment {
    return createDocumentFragment(`<style>${css}</style>`);
}

export function createRandomElementId(): string {
    return `dpus-${crypto.randomUUID()}`;
}
