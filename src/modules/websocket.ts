import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug } from './debug';

export const PIXEL_PLACED_EVENT_NAME = 'dpus:pixelPlaced';

declare global {
    interface WindowEventMap {
        [PIXEL_PLACED_EVENT_NAME]: CustomEvent<PixelPlacedData>;
    }
}

let SOCKET_PROTOTYPE_REPLACED = false;
let SOCKET_PROXY_BOUND = false;

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
    if (SOCKET_PROTOTYPE_REPLACED) {
        return;
    }

    debug('Binding WebSocket proxy');
    verifyWebSocketPrototype(window.WebSocket);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe, we're doing advanced stuff that can't really be type-checked
    window.WebSocket = WebSocketProxy as unknown as typeof window.WebSocket;
    SOCKET_PROTOTYPE_REPLACED = true;
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

const pixelPlacedMessageSchema = v.pipe(v.string(), v.parseJson(), pixelPlacedSchema);

class WebSocketProxy extends window.WebSocket {
    constructor(...args: ConstructorParameters<typeof window.WebSocket>) {
        super(...args);
        if (!SOCKET_PROXY_BOUND && args[0] === this.#pxlsSocketUrl()) {
            super.addEventListener('message', this.#handleMessage);
            SOCKET_PROXY_BOUND = true;
        }
    }

    override send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
        if (data === '{"type":"ChatbanState"}') {
            super.send(data);
        }
        console.debug('WebSocketProxy tried to send', data);
    }

    readonly #handleMessage = (event: MessageEvent<unknown>): void => {
        const pixelPlacedData = v.safeParse(pixelPlacedMessageSchema, event.data);
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
