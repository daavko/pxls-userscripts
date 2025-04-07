import { createDocumentFragment } from './document';

export type MessageType = 'success' | 'error';

const DEFAULT_MESSAGE_DURATION = 5000;

let MESSAGE_CONTAINER: Element | null = null;

export function showMessage(message: string, type: MessageType, duration = DEFAULT_MESSAGE_DURATION): void {
    let messageDivTypeClass: string;
    switch (type) {
        case 'success':
            messageDivTypeClass = 'dpus__message--success';
            break;
        case 'error':
            console.error(message);
            messageDivTypeClass = 'dpus__message--error';
            break;
        default:
            throw new Error(`Unknown message type: ${type as string}`);
    }

    const messageDiv = createDocumentFragment(`
        <div class="dpus__message ${messageDivTypeClass}">${message}</div>
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

export function showSuccessMessage(message: string, duration = DEFAULT_MESSAGE_DURATION): void {
    showMessage(message, 'success', duration);
}

export function showErrorMessage(message: string, duration = DEFAULT_MESSAGE_DURATION): void {
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
    const messageContainerStyles = createDocumentFragment(`
        <style>
            .dpus__message-container {
                position: absolute;
                top: 5px;
                left: 5px;
                right: 5px;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
                pointer-events: none;
                z-index: 100;
            }
            
            @media (width >= 1280px) {
                .dpus__message-container {
                    left: 15vw;
                    right: 15vw;
                }
            }
            
            .dpus__message {
                color: white;
                padding: 5px;
                border-radius: 5px;
            }
            
            .dpus__message--success {
                background-color: darkgreen;
            }
            
            .dpus__message--error {
                background-color: darkred;
            }
        </style>
    `);
    const messageContainer = createDocumentFragment(`
        <div class="dpus__message-container"></div>
    `).children[0];

    document.body.appendChild(messageContainerStyles);
    document.body.appendChild(messageContainer);

    return messageContainer;
}
