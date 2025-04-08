import { createDocumentFragment, createRandomElementId } from './document';
import { getGlobalSettings, type Settings, type SettingsRecord } from './settings';

export function createSettingsUI(headerTitle: string, bodyCreationFn: () => DocumentFragment[]): void {
    const optionsSidebar = document.querySelector('aside#settings > .panel-body');
    if (!optionsSidebar) {
        throw new Error('Failed to find settings sidebar');
    }

    const globalSettings = getGlobalSettings();
    const optionsHtml = createDocumentFragment(`
        <article>
            <header>
                <h3>${headerTitle}</h3>
            </header>
            <div class="pad-wrapper">
                <section></section>
            </div>
        </article>
    `);

    const header = optionsHtml.querySelector('header')!;
    const container = optionsHtml.querySelector('div.pad-wrapper')!;
    const section = optionsHtml.querySelector('div.pad-wrapper > section')!;

    header.addEventListener('click', () => {
        container.classList.toggle('hidden');
        globalSettings.set('settingsUiCollapsed', container.classList.contains('hidden'));
    });
    if (globalSettings.get('settingsUiCollapsed')) {
        container.classList.add('hidden');
    }

    const options = bodyCreationFn();
    for (const option of options) {
        section.appendChild(option);
    }

    optionsSidebar.appendChild(optionsHtml);
}

export function createBooleanSetting<OptionObject extends SettingsRecord>(
    settings: Settings<OptionObject>,
    optionKey: string,
    label: string,
): DocumentFragment {
    settings._assertBoolean(optionKey);
    const id = createRandomElementId();
    const optionHtml = createDocumentFragment(`
        <div>
            <label for="${id}" class="input-group">
                <input type="checkbox" id="${id}" ${settings._getBoolean(optionKey) ? 'checked' : ''} />
                <span class="label-text">${label}</span>
            </label>
        </div>
    `);
    const checkbox: HTMLInputElement = optionHtml.querySelector(`input#${id}`)!;
    checkbox.addEventListener('change', () => {
        settings._setBoolean(optionKey, checkbox.checked);
    });
    return optionHtml;
}

// function createNumberOption<SettingsObject extends SettingsRecord>(
//     settings: Settings<SettingsObject>,
//     optionKey: keyof SettingsObject,
//     label: string,
//     range?: [number, number],
// ): DocumentFragment {}
//
// function createStringOption<SettingsObject extends SettingsRecord>(
//     settings: Settings<SettingsObject>,
//     optionKey: keyof SettingsObject,
//     label: string,
//     values?: string[],
// ): DocumentFragment {}
//
// function createSelectOption<SettingsObject extends SettingsRecord>(
//     settings: Settings<SettingsObject>,
//     optionKey: keyof SettingsObject,
//     label: string,
//     values: string[],
// ): DocumentFragment {}

export function createSettingsButton(label: string, action: () => void): DocumentFragment {
    const buttonHtml = createDocumentFragment(`
        <div>
            <button class="text-button">${label}</button>
        </div>
    `);
    const button = buttonHtml.querySelector('button')!;
    button.addEventListener('click', action);
    return buttonHtml;
}

export function createSettingsResetButton(): DocumentFragment {
    const globalSettings = getGlobalSettings();
    return createSettingsButton('Reset options', () => {
        globalSettings.reset();
    });
}

export function createSettingsText(text: string): DocumentFragment {
    return createDocumentFragment(`<p>${text}</p>`);
}

export function createSubheading(text: string): DocumentFragment {
    return createDocumentFragment(`<h4>${text}</h4>`);
}

export function createKeyboardShortcutText(key: string, text: string): DocumentFragment {
    return createDocumentFragment(`<p><kbd>${key}</kbd> - ${text}</p>`);
}

export function createLineBreak(): DocumentFragment {
    return createDocumentFragment('<br>');
}
