import { addStylesheet, createDocumentFragment } from './document';
import infoIconStyle from './info-icon.css';
import { getScriptName } from './pxls-init';
import { getPxlsUITopUI } from './pxls-ui';

let INFO_ICONS_CONTAINER: Element | null = null;

export type InfoIconColor = 'white' | 'gray' | 'green' | 'red' | 'orange' | 'yellow';

export interface InfoIconOptions<T extends InfoIconState[]> {
    clickable: boolean;
    states: T;
}

const DEFAULT_INFO_ICON_STATES = [{ key: 'default', color: 'white' }] as const satisfies InfoIconState[];
const DEFAULT_INFO_ICON_OPTIONS: InfoIconOptions<typeof DEFAULT_INFO_ICON_STATES> = {
    clickable: false,
    states: DEFAULT_INFO_ICON_STATES,
};

export interface InfoIconState<T extends string = string> {
    key: T;
    color: InfoIconColor;
    title?: string;
}

export class InfoIcon<const T extends InfoIconState[]> {
    private readonly states: InfoIconState[];
    private activeState: InfoIconState | null = null;

    constructor(
        readonly element: Element,
        options: Partial<InfoIconOptions<T>> = {},
    ) {
        const optionsWithDefaults = {
            ...DEFAULT_INFO_ICON_OPTIONS,
            ...options,
        };
        if (optionsWithDefaults.clickable) {
            this.element.classList.add('dpus__info-icon--clickable');
        }

        this.states = optionsWithDefaults.states;
        if (this.states.length === 0) {
            throw new Error('No states provided');
        }

        this.setState(this.states[0].key);
    }

    setState(state: T[number]['key']): void {
        const newState = this.states.find((s) => s.key === state);
        if (!newState) {
            throw new Error(`State ${state} not found`);
        }

        if (this.activeState) {
            this.element.classList.remove(this.classNameFromState(this.activeState.color));
        }
        this.element.classList.add(this.classNameFromState(newState.color));
        this.activeState = newState;
        if (newState.title != null) {
            this.element.setAttribute('title', `[${getScriptName()}] ${newState.title}`.trim());
        } else {
            this.element.removeAttribute('title');
        }
    }

    private classNameFromState(state: InfoIconColor): string {
        return `dpus__info-icon--${state}`;
    }
}

export function createInfoIcon<const T extends InfoIconState[]>(
    pathData: string,
    options?: Partial<InfoIconOptions<T>>,
): InfoIcon<T> {
    const svg = createDocumentFragment(`
        <div class="dpus__info-icon">
            <svg viewBox="0 0 24 24">
                <path d="${pathData}" />
            </svg>
        </div>
    `).children[0];
    getOrInitInfoIconsContainer().appendChild(svg);
    return new InfoIcon(svg, options);
}

export function getOrInitInfoIconsContainer(): Element {
    if (INFO_ICONS_CONTAINER) {
        return INFO_ICONS_CONTAINER;
    }

    const existingInfoIconContainer = document.querySelector('.dpus__info-icons');
    if (existingInfoIconContainer) {
        INFO_ICONS_CONTAINER = existingInfoIconContainer;
    } else {
        INFO_ICONS_CONTAINER = createInfoIconContainer();
    }
    return INFO_ICONS_CONTAINER;
}

function createInfoIconContainer(): Element {
    addStylesheet('dpus__info-icons', infoIconStyle);

    const infoIconsContainer = createDocumentFragment(`<div class="dpus__info-icons"></div>`).children[0];
    getPxlsUITopUI().appendChild(infoIconsContainer);

    return infoIconsContainer;
}
