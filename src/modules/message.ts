import { addStylesheet } from './document';
import { el } from './html';
import messageContainerStyle from './message.css';

export type MessageType = 'info' | 'success' | 'error';

const DEFAULT_INFO_MESSAGE_DURATION = 3000;
const DEFAULT_SUCCESS_MESSAGE_DURATION = 3000;
const DEFAULT_ERROR_MESSAGE_DURATION = 5000;

let MESSAGE_CONTAINER: Element | null = null;

export class Messenger {
    constructor(private readonly moduleTitle: string) {}

    showInfoMessage(message: string, duration = DEFAULT_INFO_MESSAGE_DURATION): void {
        showMessage(this.formatMessage(message), 'info', duration);
    }

    showSuccessMessage(message: string, duration = DEFAULT_SUCCESS_MESSAGE_DURATION): void {
        showMessage(this.formatMessage(message), 'success', duration);
    }

    showErrorMessage(message: string, context?: Error, duration = DEFAULT_ERROR_MESSAGE_DURATION): void {
        const formattedMessage = this.formatMessage(message);
        if (context) {
            console.error(formattedMessage, context, context.cause);
        }
        showMessage(formattedMessage, 'error', duration);
    }

    private formatMessage(message: string): string {
        return `[${this.moduleTitle}] ${message}`;
    }
}

export const GLOBAL_MESSENGER = new Messenger('DPUS');

const messageDivTypeClasses: Record<MessageType, string> = {
    info: 'dpus__message--info',
    success: 'dpus__message--success',
    error: 'dpus__message--error',
};

function showMessage(message: string, type: MessageType, duration: number): void {
    const messageDiv = el('div', { class: ['dpus__message', messageDivTypeClasses[type]] }, [message]);

    const messageContainer = getOrInitMessageContainer();
    messageContainer.appendChild(messageDiv);
    setTimeout(() => {
        messageContainer.removeChild(messageDiv);
    }, duration);
}

function getOrInitMessageContainer(): Element {
    MESSAGE_CONTAINER ??= document.querySelector('.dpus__message-container') ?? createMessageContainer();
    return MESSAGE_CONTAINER;
}

function createMessageContainer(): Element {
    addStylesheet('dpus__message-container', messageContainerStyle);

    const messageContainer = el('div', { class: 'dpus__message-container' });
    document.body.appendChild(messageContainer);

    return messageContainer;
}
