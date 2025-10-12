const INSERTED_STYLESHEETS = new Map<string, CSSStyleSheet>();

export function addStylesheet(name: string, css: string): void {
    if (INSERTED_STYLESHEETS.has(name)) {
        return;
    }

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets.push(sheet);
    INSERTED_STYLESHEETS.set(name, sheet);
}

export function removeStylesheet(name: string): void {
    const sheet = INSERTED_STYLESHEETS.get(name);
    if (!sheet) {
        return;
    }

    document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
    INSERTED_STYLESHEETS.delete(name);
}

export function createRandomElementId(): string {
    return `dpus-${crypto.randomUUID()}`;
}
