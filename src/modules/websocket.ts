import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug } from './debug';
import { getDpus } from './pxls-init';

export const PIXEL_PLACED_EVENT_NAME = 'dpus:pixelPlaced';

declare global {
    interface WindowEventMap {
        [PIXEL_PLACED_EVENT_NAME]: CustomEvent<PixelPlacedData>;
    }

    interface DPUS {
        websocket: {
            socketProxyBound: boolean;
        };
    }
}

function getDpusWebSocket(): DPUS['websocket'] {
    const dpus = getDpus();
    dpus.websocket ??= {
        socketProxyBound: false,
    };
    return dpus.websocket;
}

function verifyWebSocketPrototype(websocketConstructor: typeof window.WebSocket): void {
    // @ts-expect-error -- safe, we're doing advanced stuff that can't really be type-checked
    const prototypeToStringTag = websocketConstructor.prototype[Symbol.toStringTag] as unknown;
    if (prototypeToStringTag !== 'WebSocket') {
        throw new Error(
            `Unable to verify WebSocket prototype: Symbol.toStringTag is set to "${String(prototypeToStringTag)}"`,
        );
    }
}

const NATIVE_WEBSOCKET = window.WebSocket;
verifyWebSocketPrototype(NATIVE_WEBSOCKET);

export function bindWebSocketProxy(): void {
    debug('Binding WebSocket proxy');
    verifyWebSocketPrototype(window.WebSocket);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe, we're doing advanced stuff that can't really be type-checked
    window.WebSocket = WebSocketProxy as unknown as typeof window.WebSocket;
}

const placedPixelSchema = v.object({
    x: v.number(),
    y: v.number(),
    color: v.number(),
});
export type PlacedPixelData = InferOutput<typeof placedPixelSchema>;

const pixelPlacedSchema = v.object({
    type: v.literal('pixel'),
    pixels: v.array(placedPixelSchema),
});
type PixelPlacedData = InferOutput<typeof pixelPlacedSchema>;

class WebSocketProxy extends window.WebSocket {
    constructor(...args: ConstructorParameters<typeof window.WebSocket>) {
        super(...args);
        if (!getDpusWebSocket().socketProxyBound && args[0] === this.#pxlsSocketUrl()) {
            super.addEventListener('message', this.#handleMessage);
            getDpusWebSocket().socketProxyBound = true;
        }
    }

    readonly #handleMessage = (event: MessageEvent<string>): void => {
        let parsedData: unknown;
        try {
            parsedData = JSON.parse(event.data);
        } catch (error) {
            console.error('Failed to parse WebSocket message', { error, event });
            return;
        }

        const pixelPlacedData = v.safeParse(pixelPlacedSchema, parsedData);
        if (pixelPlacedData.success) {
            window.dispatchEvent(
                new CustomEvent(PIXEL_PLACED_EVENT_NAME, {
                    detail: pixelPlacedData.output,
                }),
            );
        }
    };

    #pxlsSocketUrl(): string {
        const { protocol, host, pathname } = window.location;
        return (protocol === 'https:' ? 'wss://' : 'ws://') + host + pathname + 'ws';
    }
}
