export interface BoardRenderingContext {
    boardWidth: number;
    boardHeight: number;
    canvasWidth: number;
    canvasHeight: number;
    uniformMatrix: Float32Array;
}

export abstract class RenderLayer {
    readonly name: string;
    readonly title: string;

    constructor(name: string, title: string) {
        this.name = name;
        this.title = title;
    }

    abstract createRenderables(gl: WebGL2RenderingContext): void;
    abstract destroyRenderables(): void;
    abstract render(projectionMatrixUniform: Float32Array): void;
}

export abstract class Renderable {
    protected readonly gl: WebGL2RenderingContext;

    protected constructor(gl: WebGL2RenderingContext) {
        this.gl = gl;
    }

    abstract render(projectionMatrixUniform: Float32Array): void;
    abstract destroy(gl: WebGL2RenderingContext): void;
}

type TextureDataArray = Uint32Array | Uint8Array | Uint16Array;

// a number indicates the y-coordinate of a changed row
// a tuple [yStart, height] indicates a range of changed rows
export type ChangedRegionDefinition = number | [number, number];

export interface RenderableTextureData<T extends TextureDataArray> {
    get dataChanged(): boolean | ChangedRegionDefinition[];
    get data(): T | null;
    getPixel(x: number, y: number): number | undefined;
    getPixelByIndex(index: number): number | undefined;
    setPixel(x: number, y: number, color: number): void;
    setPixelByIndex(index: number, color: number): void;
}

export interface PxlsExtendedBoardRenderable {
    readonly name: string;
    readonly title: string;
    readonly initialized: boolean;
    init: (ctx: WebGL2RenderingContext) => void;
    render: (ctx: WebGL2RenderingContext, boardCtx: BoardRenderingContext) => void;
    destroy: (ctx: WebGL2RenderingContext) => void;
}

export interface PxlsExtendedBoardModule {
    registerRenderLayer: (layer: PxlsExtendedBoardRenderable) => void;
    screenSpaceCoordIsOnBoard: (x: number, y: number) => boolean;
    readonly boardCanvas: HTMLCanvasElement;
}
