import { createDocumentFragment } from '../document';

export function showError(message: string, duration = 5000): void {
    console.error(message);

    const errorDiv = createDocumentFragment(
        `<div style="background-color: red; color: white; padding: 5px;">${message}</div>`,
    );

    const errorContainer = document.querySelector('body > header > .mid');
    if (!errorContainer) {
        throw new Error('Failed to find error container, this should never happen');
    }

    const errorDivChildren = Array.from(errorDiv.children);
    errorContainer.appendChild(errorDiv);
    setTimeout(() => {
        for (const child of errorDivChildren) {
            errorContainer.removeChild(child);
        }
    }, duration);
}
