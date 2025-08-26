export interface BoardRenderingContext {
    boardWidth: number;
    boardHeight: number;
    canvasWidth: number;
    canvasHeight: number;
    uniformMatrix: Float32Array;
}

export interface PxlsExtendedBoardRenderable {
    name: string;
    title: string;
    init: (ctx: WebGL2RenderingContext) => void;
    render: (ctx: WebGL2RenderingContext, boardCtx: BoardRenderingContext) => void;
    destroy: (ctx: WebGL2RenderingContext) => void;
}

export interface PxlsExtendedBoardModule {
    registerRenderLayer: (layer: PxlsExtendedBoardRenderable) => void;
}
