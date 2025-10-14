import { getPxlsInfo } from './pxls-fetch';
import { getPxlsUIPaletteDeselectButton, getPxlsUIPaletteSelectionButtons } from './pxls-ui';

export function unselectColor(): void {
    const button = getPxlsUIPaletteDeselectButton();
    if (button.classList.contains('active')) {
        button.click();
    }
}

export function anyColorSelected(): boolean {
    const button = getPxlsUIPaletteDeselectButton();
    return button.classList.contains('active');
}

export function selectColor(colorIndex: number): void {
    const buttons = getPxlsUIPaletteSelectionButtons();
    const button = buttons.at(colorIndex);
    if (button && !button.classList.contains('active')) {
        button.click();
    }
}

export async function getFastLookupPalette(): Promise<number[]> {
    const pxlsInfo = await getPxlsInfo();
    if (!pxlsInfo) {
        throw new Error('Failed to fetch /info');
    }

    return pxlsInfo.palette.map(({ value: hexValue }) => {
        const r = parseInt(hexValue.slice(1, 3), 16);
        const g = parseInt(hexValue.slice(3, 5), 16);
        const b = parseInt(hexValue.slice(5, 7), 16);
        const a = 255;
        return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    });
}
