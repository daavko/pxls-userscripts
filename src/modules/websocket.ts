import { mdiWifiStrength4, mdiWifiStrengthOff, mdiWifiStrengthOutline } from '@mdi/js';
import type { InferOutput } from 'valibot';
import * as v from 'valibot';
import { debug } from './debug';
import { InfoIcon } from './info-icon';
import { GLOBAL_MESSENGER } from './message';
import { waitForBoardLoaded } from './pxls-ui';

export const PIXEL_PLACED_EVENT_NAME = 'dpus:pixelPlaced';
// upon this event, everything listening to this socket must re-read current canvas state
export const PIXEL_SOCKET_CONNECTED_EVENT_NAME = 'dpus:pixelSocketConnected';

declare global {
    interface WindowEventMap {
        [PIXEL_PLACED_EVENT_NAME]: CustomEvent<PixelPlacedData>;
        [PIXEL_SOCKET_CONNECTED_EVENT_NAME]: CustomEvent<void>;
    }
}

const connectionInfoIcon = new InfoIcon('Websocket connection', mdiWifiStrengthOff, {
    clickable: false,
    states: [
        { key: 'default', color: 'white', title: 'Idle' },
        { key: 'connecting', color: 'yellow', title: 'Connecting', pathData: mdiWifiStrengthOutline },
        { key: 'connected', color: 'green', title: 'Connected', pathData: mdiWifiStrength4 },
    ],
});

const SOCKET_MAX_DELAY_MS = 10_000;
const SOCKET_DEFAULT_DELAY_MS = 1000;

let lastDelayMs = SOCKET_DEFAULT_DELAY_MS;
let currentOpenSocket: WebSocket | null = null;
let sentInitialCanvasState = false;
let pixelSocketPromise: Promise<void> | null = null;

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

export function enablePixelSocket(): void {
    pixelSocketPromise ??= createSocketPromise().catch((e: unknown) => {
        debug('Error during websocket initialization', e);
        GLOBAL_MESSENGER.showErrorMessage(
            'Error during websocket initialization. Please reload. If this keeps happening, please report it.',
        );
    });
}

async function createSocketPromise(): Promise<void> {
    await waitForBoardLoaded();
    connectionInfoIcon.addToIconsContainer();
    connect();
}

function connect(): void {
    if (currentOpenSocket != null) {
        return;
    }

    const socket = new WebSocket(
        `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`,
    );
    currentOpenSocket = socket;
    connectionInfoIcon.setState('connecting');

    socket.addEventListener('message', (event) => {
        const pixelPlacedData = v.safeParse(pixelPlacedMessageSchema, event.data);
        if (pixelPlacedData.success) {
            if (!sentInitialCanvasState) {
                window.dispatchEvent(new CustomEvent(PIXEL_SOCKET_CONNECTED_EVENT_NAME));

                sentInitialCanvasState = true;
            }

            window.dispatchEvent(
                new CustomEvent(PIXEL_PLACED_EVENT_NAME, {
                    detail: pixelPlacedData.output,
                }),
            );
        }
    });
    socket.addEventListener('open', () => {
        connectionInfoIcon.setState('connected');
        lastDelayMs = SOCKET_DEFAULT_DELAY_MS;
    });
    socket.addEventListener('close', (event) => {
        debug(`Websocket closed (code: ${event.code}, clean: ${event.wasClean}, reason: ${event.reason}`);
        lastDelayMs = Math.min(lastDelayMs * 2, SOCKET_MAX_DELAY_MS);
        connectionInfoIcon.setState('connecting');
        sentInitialCanvasState = false;
        setTimeout(() => {
            connect();
        }, lastDelayMs);
    });
    socket.addEventListener('error', (event) => {
        debug('Websocket closed due to an error', event);
    });
}

export class PixelEventReplayer {
    private readonly buffer: PlacedPixelData[] = [];

    constructor() {
        window.addEventListener(PIXEL_PLACED_EVENT_NAME, this.handler);
    }

    consume(): PlacedPixelData[] {
        window.removeEventListener(PIXEL_PLACED_EVENT_NAME, this.handler);
        return this.buffer;
    }

    private readonly handler = ({ detail: { pixels } }: WindowEventMap[typeof PIXEL_PLACED_EVENT_NAME]): void => {
        this.buffer.push(...pixels);
    };
}
