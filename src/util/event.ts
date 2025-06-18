export function eventTargetIsTextInput(event: Event): boolean {
    return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
}
