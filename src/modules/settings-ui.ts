import { addStylesheet, createRandomElementId } from './document';
import { el } from './html';
import { GLOBAL_MESSENGER } from './message';
import { BooleanSetting, Settings, type Setting } from './settings';
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

export function createSettingsUI(scriptId: string, scriptTitle: string, bodyCreationFn: () => HTMLElement[]): void {
    const settingsContainer = getOrCreateSettingsContainer();

    const settingsUiSettings = Settings.create(`${scriptId}_settingsUI`, {
        settingsUiCollapsed: new BooleanSetting(false),
    });

    const header = el('header', [el('h3', [scriptTitle])]);
    const section = el('section');
    const container = el('div', { class: 'pad-wrapper' }, [section]);

    header.addEventListener('click', () => {
        container.classList.toggle('hidden');
        settingsUiSettings.settingsUiCollapsed.set(container.classList.contains('hidden'));
    });
    settingsUiSettings.settingsUiCollapsed.addCallback((_oldValue, newValue) => {
        container.classList.toggle('hidden', newValue);
    });
    if (settingsUiSettings.settingsUiCollapsed.get()) {
        container.classList.add('hidden');
    }

    const options = bodyCreationFn();
    for (const option of options) {
        section.appendChild(option);
    }
    settingsContainer.appendChild(el('article', [header, container]));
}

export function createBooleanSetting(setting: Setting<unknown, boolean>, label: string): HTMLElement {
    const id = createRandomElementId();
    const checkbox = el('input', {
        id,
        attributes: { type: 'checkbox', checked: setting.serializeValue(setting.get()) },
    });
    checkbox.addEventListener('change', () => {
        setting.set(setting.parseValue(checkbox.checked));
    });
    setting.addCallback(() => {
        checkbox.checked = setting.serializeValue(setting.get());
    });
    return el('div', [
        el('label', { class: 'input-group', attributes: { for: id } }, [
            checkbox,
            el('span', { class: 'label-text' }, [label]),
        ]),
    ]);
}

export function createNumberSetting(
    setting: Setting<unknown, number>,
    label: string,
    range?: { min?: number; max?: number },
): HTMLElement {
    const id = createRandomElementId();
    const rangeMin = range?.min;
    const rangeMax = range?.max;
    const input = el('input', {
        class: 'fullwidth',
        id,
        attributes: { type: 'number', value: setting.serializeValue(setting.get()), min: rangeMin, max: rangeMax },
    });
    input.addEventListener('change', () => {
        const value = parseFloat(input.value);
        if (rangeMin != null && value < rangeMin) {
            GLOBAL_MESSENGER.showErrorMessage(
                `Value for option "${label}" is below minimum: ${value} (min: ${rangeMin})`,
            );
        }
        if (rangeMax != null && value > rangeMax) {
            GLOBAL_MESSENGER.showErrorMessage(
                `Value for option "${label}" is above maximum: ${value} (max: ${rangeMax})`,
            );
        }
        setting.set(value);
    });
    setting.addCallback(() => {
        input.value = setting.serializeValue(setting.get()).toString();
    });
    return el('div', [
        el('label', { class: 'input-group', attributes: { for: id } }, [
            el('span', { class: 'label-text' }, [label]),
            input,
        ]),
    ]);
}

export function createStringSetting(setting: Setting<unknown, string>, label: string): HTMLElement {
    const id = createRandomElementId();
    const input = el('input', {
        class: 'fullwidth',
        id,
        attributes: { type: 'text', value: setting.serializeValue(setting.get()) },
    });
    input.addEventListener('change', () => {
        setting.set(setting.parseValue(input.value));
    });
    setting.addCallback(() => {
        input.value = setting.serializeValue(setting.get());
    });
    return el('div', [
        el('label', { class: 'input-group', attributes: { for: id } }, [
            el('span', { class: 'label-text' }, [label]),
            input,
        ]),
    ]);
}

export function createSelectSetting<const T extends string>(
    setting: Setting<T, string>,
    label: string,
    options: { value: T; label: string; title?: string }[],
): HTMLElement {
    const id = createRandomElementId();
    const select = el(
        'select',
        { id },
        options.map((option) =>
            el('option', { attributes: { value: option.value, title: option.title } }, [option.label]),
        ),
    );
    select.value = setting.serializeValue(setting.get());
    select.addEventListener('change', () => {
        setting.set(setting.parseValue(select.value));
    });
    setting.addCallback(() => {
        select.value = setting.serializeValue(setting.get());
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

export function createSettingsResetButton(settings: Settings<Record<string, Setting<unknown, unknown>>>): HTMLElement {
    return createSettingsButton('Reset options', () => {
        settings.reset();
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
