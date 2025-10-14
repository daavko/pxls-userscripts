import { addStylesheet } from './document';
import { el, svgEl } from './html';
import infoIconStyle from './info-icon.css';
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
        readonly element: HTMLElement,
        private readonly title: string,
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

    addToIconsContainer(): void {
        const container = getOrInitInfoIconsContainer();
        if (!container.contains(this.element)) {
            container.appendChild(this.element);
        }
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
            this.element.setAttribute('title', `[${this.title}] ${newState.title}`.trim());
        } else {
            this.element.removeAttribute('title');
        }
    }

    toggleHidden(hide?: boolean): void {
        this.element.classList.toggle('dpus__info-icon--hidden', hide);
    }

    private classNameFromState(state: InfoIconColor): string {
        return `dpus__info-icon--${state}`;
    }
}

export function createInfoIcon<const T extends InfoIconState[]>(
    title: string,
    pathData: string,
    options?: Partial<InfoIconOptions<T>>,
): InfoIcon<T> {
    const svg = el('div', { class: 'dpus__info-icon' }, [
        svgEl('svg', { attributes: { viewBox: '0 0 24 24' } }, [svgEl('path', { attributes: { d: pathData } })]),
    ]);
    return new InfoIcon(svg, title, options);
}

export function getOrInitInfoIconsContainer(): Element {
    INFO_ICONS_CONTAINER ??= document.querySelector('.dpus__info-icons') ?? createInfoIconContainer();
    return INFO_ICONS_CONTAINER;
}

function createInfoIconContainer(): Element {
    addStylesheet('dpus__info-icons', infoIconStyle);

    const infoIconsContainer = el('div', { class: 'dpus__info-icons' });
    getPxlsUITopUI().appendChild(infoIconsContainer);

    return infoIconsContainer;
}
