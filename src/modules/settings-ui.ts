import { addStylesheet, createRandomElementId } from './document';
import { el } from './html';
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

    const settingsContainer = el('div', { class: 'dpus__settings-ui' });
    optionsSidebar.appendChild(settingsContainer);

    return settingsContainer;
}

export function createSettingsUI(bodyCreationFn: () => HTMLElement[]): void {
    const settingsContainer = getOrCreateSettingsContainer();

    const globalSettings = getGlobalSettings();

    const scriptIndex = getDpusGlobal().scripts.indexOf(getScriptId());

    const header = el('header', [el('h3', [getScriptName()])]);
    const section = el('section', []);
    const container = el('div', { class: 'pad-wrapper' }, [section]);

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
    settingsContainer.appendChild(el('article', { style: { order: `${scriptIndex}` } }, [header, container]));
}

export function createBooleanSetting<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: BooleanOptionKeys<T>,
    label: string,
): HTMLElement {
    const id = createRandomElementId();
    const checkbox = el('input', {
        id,
        attributes: { type: 'checkbox', checked: settings._getBoolean(optionKey) },
    });
    checkbox.addEventListener('change', () => {
        settings._setBoolean(optionKey, checkbox.checked);
    });
    settings.addCallback(optionKey, () => {
        checkbox.checked = settings._getBoolean(optionKey);
    });
    return el('div', [
        el('label', { class: 'input-group', attributes: { for: id } }, [
            checkbox,
            el('span', { class: 'label-text' }, [label]),
        ]),
    ]);
}

export function createNumberOption<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: NumberOptionKeys<T>,
    label: string,
    range?: { min?: number; max?: number },
): HTMLElement {
    const id = createRandomElementId();
    const rangeMin = range?.min;
    const rangeMax = range?.max;
    const input = el('input', {
        id,
        attributes: { type: 'number', value: settings._getNumber(optionKey), min: rangeMin, max: rangeMax },
    });
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
        input.value = settings._getNumber(optionKey).toString();
    });
    return el('div', [
        el('label', { class: 'input-group', attributes: { for: id } }, [
            el('span', { class: 'label-text' }, [label]),
            input,
        ]),
    ]);
}

export function createStringSetting<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: StringOptionKeys<T>,
    label: string,
): HTMLElement {
    const id = createRandomElementId();
    const input = el('input', {
        class: 'fullwidth',
        id,
        attributes: { type: 'text', value: settings._getString(optionKey) },
    });
    input.addEventListener('change', () => {
        settings._setString(optionKey, input.value);
    });
    settings.addCallback(optionKey, () => {
        input.value = settings._getString(optionKey);
    });
    return el('div', [
        el('label', { class: 'input-group', attributes: { for: id } }, [
            el('span', { class: 'label-text' }, [label]),
            input,
        ]),
    ]);
}

export function createSelectSetting<T extends Record<string, unknown>>(
    settings: Settings<T>,
    optionKey: StringOptionKeys<T>,
    label: string,
    options: { value: string; label: string; title?: string }[],
): HTMLElement {
    const id = createRandomElementId();
    const select = el(
        'select',
        { id },
        options.map((option) =>
            el('option', { attributes: { value: option.value, title: option.title } }, [option.label]),
        ),
    );
    select.value = settings._getString(optionKey);
    select.addEventListener('change', () => {
        settings._setString(optionKey, select.value);
    });
    settings.addCallback(optionKey, () => {
        select.value = settings._getString(optionKey);
    });
    return el('div', [
        el('label', { class: 'input-group', attributes: { for: id } }, [
            el('span', { class: 'label-text' }, [label]),
            select,
        ]),
    ]);
}

export function createSettingsButton(label: string, action: () => void): HTMLElement {
    const button = el('button', { class: 'text-button' }, [label]);
    button.addEventListener('click', action);

    return el('div', [button]);
}

export function createSettingsResetButton(scriptSettings: Settings<Record<string, unknown>>[] = []): HTMLElement {
    const globalSettings = getGlobalSettings();
    return createSettingsButton('Reset options', () => {
        globalSettings.reset();
        for (const settings of scriptSettings) {
            settings.reset();
        }
    });
}

export function createSettingsText(text: string): HTMLElement {
    return el('p', [text]);
}

export function createSubheading(text: string): HTMLElement {
    return el('h4', [text]);
}

export function createKeyboardShortcutText(key: string, text: string): HTMLElement {
    return el('p', [el('kbd', [key]), ` - ${text}`]);
}

export function createLineBreak(): HTMLElement {
    return el('br');
}
