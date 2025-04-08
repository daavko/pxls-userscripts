export function createDocumentFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

export function addStylesheet(css: string): void {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets.push(sheet);
}

export function createRandomElementId(): string {
    return `dpus-${crypto.randomUUID()}`;
}
