import { debug } from './debug';
import { addStylesheet, createDocumentFragment } from './document';
import messageContainerStyle from './message.css';

export type MessageType = 'success' | 'error';

const DEFAULT_SUCCESS_MESSAGE_DURATION = 3000;
const DEFAULT_ERROR_MESSAGE_DURATION = 5000;

let MESSAGE_CONTAINER: Element | null = null;
let MESSAGE_PREFIX: string | null = null;

export function setMessagePrefix(prefix: string): void {
    MESSAGE_PREFIX = prefix;
}

export function showMessage(message: string, type: MessageType, duration: number): void {
    let messageDivTypeClass: string;
    switch (type) {
        case 'success':
            messageDivTypeClass = 'dpus__message--success';
            break;
        case 'error':
            messageDivTypeClass = 'dpus__message--error';
            break;
        default:
            throw new Error(`Unknown message type: ${type as string}`);
    }

    const messageDiv = createDocumentFragment(`
        <div class="dpus__message ${messageDivTypeClass}">[${MESSAGE_PREFIX}] ${message}</div>
    `);

    const messageDivChildren = Array.from(messageDiv.children);
    const messageContainer = getOrInitMessageContainer();
    messageContainer.appendChild(messageDiv);
    setTimeout(() => {
        for (const child of messageDivChildren) {
            messageContainer.removeChild(child);
        }
    }, duration);
}

export function showSuccessMessage(message: string, duration = DEFAULT_SUCCESS_MESSAGE_DURATION): void {
    debug('Showing success message:', message);
    showMessage(message, 'success', duration);
}

export function showErrorMessage(message: string, context?: Error, duration = DEFAULT_ERROR_MESSAGE_DURATION): void {
    if (context) {
        console.error(`[${MESSAGE_PREFIX}] ${message}`, context);
    }
    showMessage(message, 'error', duration);
}

function getOrInitMessageContainer(): Element {
    if (MESSAGE_CONTAINER) {
        return MESSAGE_CONTAINER;
    }

    const existingMessageContainer = document.querySelector('.dpus__message-container');
    if (existingMessageContainer) {
        MESSAGE_CONTAINER = existingMessageContainer;
    } else {
        MESSAGE_CONTAINER = createMessageContainer();
    }
    return MESSAGE_CONTAINER;
}

function createMessageContainer(): Element {
    addStylesheet('dpus__message-container', messageContainerStyle);

    const messageContainer = createDocumentFragment(`
        <div class="dpus__message-container"></div>
    `).children[0];
    document.body.appendChild(messageContainer);

    return messageContainer;
}
