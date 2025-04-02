import { createDocumentFragment } from '../document';

export function showSuccessMessage(message: string, duration = 5000): void {
    const successDiv = createDocumentFragment(
        `<div style="background-color: green; color: white; padding: 5px;">${message}</div>`,
    );

    const successContainer = document.querySelector('body > header > .mid');
    if (!successContainer) {
        throw new Error('Failed to find success container, this should never happen');
    }

    const successDivChildren = Array.from(successDiv.children);
    successContainer.appendChild(successDiv);
    setTimeout(() => {
        for (const child of successDivChildren) {
            successContainer.removeChild(child);
        }
    }, duration);
}
