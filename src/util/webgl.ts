import type { BoardRenderingContext, PxlsExtendedBoardRenderLayer } from '../pxls/pxls-modules-ext';

export function compileShader(
    gl: WebGL2RenderingContext,
    source: string,
    shaderType: WebGL2RenderingContext['VERTEX_SHADER'] | WebGL2RenderingContext['FRAGMENT_SHADER'],
): WebGLShader {
    const shader = gl.createShader(shaderType);
    if (shader == null) {
        throw new Error('Failed to create shader');
    }
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
    if (success) {
        return shader;
    } else {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error('Failed to compile shader', { cause: info });
    }
}

export function createProgram(
    gl: WebGL2RenderingContext,
    vertexShader: WebGLShader,
    fragmentShader: WebGLShader,
): WebGLProgram {
    const program = gl.createProgram();

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
    const success = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;

    if (success) {
        return program;
    } else {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error('Failed to link program', { cause: info });
    }
}

export class CanvasResizeWatcher {
    private readonly canvas: HTMLCanvasElement;
    private readonly resizeObserver: ResizeObserver;

    private lastKnownWidth = 0;
    private lastKnownHeight = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.resizeObserver = new ResizeObserver(this.onResize);

        this.lastKnownWidth = canvas.width;
        this.lastKnownHeight = canvas.height;
    }

    startWatching(): void {
        try {
            this.resizeObserver.observe(this.canvas, { box: 'device-pixel-content-box' });
        } catch (e) {
            console.warn('ResizeObserver with device-pixel-content-box failed, falling back to content-box', e);
            this.resizeObserver.observe(this.canvas, { box: 'content-box' });
        }
    }

    stopWatching(): void {
        this.resizeObserver.disconnect();
    }

    resizeCanvasIfNeeded(): void {
        if (this.canvas.width !== this.lastKnownWidth || this.canvas.height !== this.lastKnownHeight) {
            this.canvas.width = this.lastKnownWidth;
            this.canvas.height = this.lastKnownHeight;
        }
    }

    setViewportSize(gl: WebGL2RenderingContext): void {
        this.resizeCanvasIfNeeded();
        gl.viewport(0, 0, this.lastKnownWidth, this.lastKnownHeight);
    }

    private readonly onResize = (entries: ResizeObserverEntry[]): void => {
        for (const entry of entries) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- not true
            if (entry.devicePixelContentBoxSize != null) {
                this.lastKnownWidth = entry.devicePixelContentBoxSize[0].inlineSize;
                this.lastKnownHeight = entry.devicePixelContentBoxSize[0].blockSize;
            } else {
                const dpr = window.devicePixelRatio;
                this.lastKnownWidth = Math.round(entry.contentRect.width * dpr);
                this.lastKnownHeight = Math.round(entry.contentRect.height * dpr);
            }
        }
    };
}

export abstract class CanvasLayer implements PxlsExtendedBoardRenderLayer {
    readonly name: string;
    readonly title: string;

    private readonly rect: DOMRect;
    private readonly textureBufferData: Uint32Array;
    // todo: instead of this, maybe use update regions that get triggered whenever the texture is changed in that region...
    //  then we can update only those regions and save some memory bandwith
    private textureChangedSinceLastRender = true;

    private texCoordBuffer: WebGLBuffer | null = null;
    // prettier-ignore
    private readonly texCoordBufferData = new Float32Array([
        0.0, 0.0,
        1.0, 0.0,
        0.0, 1.0,
        0.0, 1.0,
        1.0, 0.0,
        1.0, 1.0,
    ]);

    private vertexBufferData: Float32Array;
    private vertexBuffer: WebGLBuffer | null = null;

    private program: WebGLProgram | null = null;

    protected constructor(name: string, title: string, rect: DOMRect) {
        this.name = name;
        this.title = title;

        // copy to avoid external mutations
        this.rect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
        this.textureBufferData = new Uint32Array(rect.width * rect.height);
        this.vertexBufferData = this.createVertexBufferData();
    }

    get x(): number {
        return this.rect.x;
    }

    get y(): number {
        return this.rect.y;
    }

    get width(): number {
        return this.rect.width;
    }

    get height(): number {
        return this.rect.height;
    }

    protected abstract get vertexShaderSource(): string;

    protected abstract get fragmentShaderSource(): string;

    set x(value: number) {
        this.rect.x = value;
        this.updateVertexBufferData();
    }
    set y(value: number) {
        this.rect.y = value;
        this.updateVertexBufferData();
    }

    init(ctx: WebGL2RenderingContext): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- safe
        const maxTextureSize = ctx.getParameter(ctx.MAX_TEXTURE_SIZE) as number;
        if (this.rect.width > maxTextureSize || this.rect.height > maxTextureSize) {
            throw new Error(
                `Layer texture size ${this.rect.width}x${this.rect.height} exceeds maximum supported size of ${maxTextureSize}x${maxTextureSize}`,
            );
        }

        const vertexShader = compileShader(ctx, this.vertexShaderSource, ctx.VERTEX_SHADER);
        const fragmentShader = compileShader(ctx, this.fragmentShaderSource, ctx.FRAGMENT_SHADER);
        this.program = createProgram(ctx, vertexShader, fragmentShader);

        this.texCoordBuffer = ctx.createBuffer();
        this.vertexBuffer = ctx.createBuffer();
    }

    render(ctx: WebGL2RenderingContext, boardCtx: BoardRenderingContext): void {
        if (this.program == null) {
            console.warn(`Render layer "${this.name}" not initialized, this should never happen`);
            return;
        }

        ctx.useProgram(this.program);

        // todo: bind vertex array
        // todo: set uniforms
        // todo: bind texture/s
        this.bindVertexBuffer(ctx);
        this.bindTexCoordBuffer(ctx);

        // todo: draw call

        this.unbindTexCoordBuffer(ctx);
        this.unbindVertexBuffer(ctx);
        ctx.useProgram(null);
    }

    destroy(ctx: WebGL2RenderingContext): void {
        ctx.deleteProgram(this.program);
        this.program = null;

        ctx.deleteBuffer(this.vertexBuffer);
        this.vertexBuffer = null;

        ctx.deleteBuffer(this.texCoordBuffer);
        this.texCoordBuffer = null;
    }

    setPixel(x: number, y: number, color: number): void {
        this.textureBufferData[this.getIndex(x, y)] = color;
        this.textureChangedSinceLastRender = true;
    }

    getPixel(x: number, y: number): number {
        return this.textureBufferData[this.getIndex(x, y)];
    }

    private getIndex(x: number, y: number): number {
        if (x < 0 || x >= this.rect.width || y < 0 || y >= this.rect.height) {
            throw new Error(`Pixel coordinates out of bounds: (${x}, ${y})`);
        }
        return y * this.rect.width + x;
    }

    private createVertexBufferData(): Float32Array {
        const x1 = this.rect.x;
        const y1 = this.rect.y;
        const x2 = this.rect.x + this.rect.width;
        const y2 = this.rect.y + this.rect.height;

        // prettier-ignore
        return new Float32Array([
            x1, y1,
            x2, y1,
            x1, y2,
            x1, y2,
            x2, y1,
            x2, y2
        ]);
    }

    private updateVertexBufferData(): void {
        this.vertexBufferData = this.createVertexBufferData();
    }

    private bindVertexBuffer(ctx: WebGL2RenderingContext): void {
        if (this.vertexBuffer == null) {
            throw new Error('Vertex buffer not initialized');
        }
        ctx.bindBuffer(ctx.ARRAY_BUFFER, this.vertexBuffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, this.vertexBufferData, ctx.STATIC_DRAW);
    }

    private unbindVertexBuffer(ctx: WebGL2RenderingContext): void {
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
    }

    private bindTexCoordBuffer(ctx: WebGL2RenderingContext): void {
        if (this.texCoordBuffer == null) {
            throw new Error('TexCoord buffer not initialized');
        }
        ctx.bindBuffer(ctx.ARRAY_BUFFER, this.texCoordBuffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, this.texCoordBufferData, ctx.STATIC_DRAW);
    }

    private unbindTexCoordBuffer(ctx: WebGL2RenderingContext): void {
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
    }

    private bindTextureData(ctx: WebGL2RenderingContext): void {}

    private unbindTextureData(ctx: WebGL2RenderingContext): void {}
}
