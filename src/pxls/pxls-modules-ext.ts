export interface BoardRenderingContext {
    boardWidth: number;
    boardHeight: number;
    canvasWidth: number;
    canvasHeight: number;
}

export interface PxlsExtendedBoardRenderLayer {
    name: string;
    title: string;
    init: (ctx: WebGL2RenderingContext) => void;
    render: (ctx: WebGL2RenderingContext, boardCtx: BoardRenderingContext) => void;
    delete: (ctx: WebGL2RenderingContext) => void;
}

export interface PxlsExtendedBoardModule {
    registerRenderLayer: (layer: PxlsExtendedBoardRenderLayer) => void;
}
