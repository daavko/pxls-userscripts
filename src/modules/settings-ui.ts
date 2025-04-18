import { addStylesheet, createDocumentFragment, createRandomElementId } from './document';
import { showErrorMessage } from './message';
import { getDpusGlobal, getScriptId, getScriptName } from './pxls-init';
import {
    type BooleanOptionKeys,
    getGlobalSettings,
    type NumberOptionKeys,
    Settings,
    type StringOptionKeys,
} from './settings';
import settingsUiStyle from './settings-ui.css';

function getOrCreateSettingsContainer(): Element {
    const settingsContainer = document.querySelector('aside#settings .dpus__settings-ui');

    if (settingsContainer) {
        return settingsContainer;
    } else {
        return createSettingsContainer();
    }
}

function createSettingsContainer(): Element {
    const optionsSidebar = document.querySelector('aside#settings > .panel-body');
    if (!optionsSidebar) {
        throw new Error('Failed to find settings sidebar');
    }

    addStylesheet('dpus__settings-ui', settingsUiStyle);

    const settingsContainer = createDocumentFragment(`<div class="dpus__settings-ui"></div>`).children[0];
    optionsSidebar.appendChild(settingsContainer);

    return settingsContainer;
}

export function createSettingsUI(bodyCreationFn: () => DocumentFragment[]): void {
    const settingsContainer = getOrCreateSettingsContainer();

    const globalSettings = getGlobalSettings();

    const scriptIndex = getDpusGlobal().scripts.indexOf(getScriptId());
    const optionsHtml = createDocumentFragment(`
        <article style="order: ${scriptIndex};">
            <header>
                <h3>${getScriptName()}</h3>
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

    settingsContainer.appendChild(optionsHtml);
}

export function createBooleanSetting<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: BooleanOptionKeys<T>,
    label: string,
): DocumentFragment {
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
    settings.addCallback(optionKey, () => {
        checkbox.checked = settings._getBoolean(optionKey);
    });
    return optionHtml;
}

export function createNumberOption<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: NumberOptionKeys<T>,
    label: string,
    range?: { min?: number; max?: number },
): DocumentFragment {
    const id = createRandomElementId();
    const optionHtml = createDocumentFragment(`
        <div>
            <label for="${id}" class="input-group">
                <span class="label-text">${label}:</span>
                <input type="number" id="${id}" value="${settings._getString(optionKey)}" />
            </label>
        </div>
    `);
    const input: HTMLInputElement = optionHtml.querySelector(`input#${id}`)!;
    const rangeMin = range?.min;
    const rangeMax = range?.max;
    if (rangeMin != null) {
        input.min = rangeMin.toString();
    }
    if (rangeMax != null) {
        input.max = rangeMax.toString();
    }
    input.addEventListener('change', () => {
        const value = parseFloat(input.value);
        if (rangeMin != null && value < rangeMin) {
            showErrorMessage(`Value for option "${label}" is below minimum: ${value} (min: ${rangeMin})`);
        }
        if (rangeMax != null && value > rangeMax) {
            showErrorMessage(`Value for option "${label}" is above maximum: ${value} (max: ${rangeMax})`);
        }
        settings._setNumber(optionKey, value);
    });
    settings.addCallback(optionKey, () => {
        input.value = settings._getString(optionKey).toString();
    });
    return optionHtml;
}

export function createStringSetting<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: StringOptionKeys<T>,
    label: string,
): DocumentFragment {
    const id = createRandomElementId();
    const optionHtml = createDocumentFragment(`
        <div>
            <label for="${id}" class="input-group">
                <span class="label-text">${label}:</span>
                <input type="text" id="${id}" class="fullwidth" value="${settings._getString(optionKey)}" />
            </label>
        </div>
    `);
    const input: HTMLInputElement = optionHtml.querySelector(`input#${id}`)!;
    input.addEventListener('change', () => {
        settings._setString(optionKey, input.value);
    });
    settings.addCallback(optionKey, () => {
        input.value = settings._getString(optionKey);
    });
    return optionHtml;
}

export function createSelectSetting<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: StringOptionKeys<T>,
    label: string,
    options: { value: string; label: string; title?: string }[],
): DocumentFragment {
    const id = createRandomElementId();
    const optionHtml = createDocumentFragment(`
        <div>
            <label for="${id}" class="input-group">
                <span class="label-text">${label}:</span>
                <select id="${id}"></select>
            </label>
        </div>
    `);
    const select: HTMLSelectElement = optionHtml.querySelector(`select#${id}`)!;
    for (const option of options) {
        const optionElement = createDocumentFragment(`<option value="${option.value}">${option.label}</option>`)
            .children[0];
        if (option.title != null) {
            optionElement.setAttribute('title', option.title);
        }
        select.appendChild(optionElement);
    }
    select.value = settings._getString(optionKey);
    select.addEventListener('change', () => {
        settings._setString(optionKey, select.value);
    });
    settings.addCallback(optionKey, () => {
        select.value = settings._getString(optionKey);
    });
    return optionHtml;
}

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
