import { getDpus } from './pxls-init';

declare global {
    interface DPUS {
        dpusDocument: {
            stylesheets: string[];
        };
    }
}

function getDpusDocument(): DPUS['dpusDocument'] {
    const dpus = getDpus();
    dpus.dpusDocument ??= {
        stylesheets: [],
    };
    return dpus.dpusDocument;
}

export function createDocumentFragment(html: string): DocumentFragment {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content;
}

export function addStylesheet(name: string, css: string): void {
    const dpusDocument = getDpusDocument();

    if (dpusDocument.stylesheets.includes(name)) {
        return;
    }

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    document.adoptedStyleSheets.push(sheet);
    dpusDocument.stylesheets.push(name);
}

export function createRandomElementId(): string {
    return `dpus-${crypto.randomUUID()}`;
}
