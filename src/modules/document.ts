declare global {
    interface Window {
        dpusStyleSheets?: string[];
    }
}

export function createDocumentFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

export function addStylesheet(name: string, css: string): void {
    window.dpusStyleSheets ??= [];

    if (window.dpusStyleSheets.includes(name)) {
        return;
    }

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets.push(sheet);
    window.dpusStyleSheets.push(name);
}

export function createRandomElementId(): string {
    return `dpus-${crypto.randomUUID()}`;
}
