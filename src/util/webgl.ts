import type { BoardRenderingContext, PxlsExtendedBoardRenderable } from '../pxls/pxls-modules-ext';

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

    getSize(): { width: number; height: number } {
        return { width: this.lastKnownWidth, height: this.lastKnownHeight };
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

interface PersistentCanvasLayerState {
    program: WebGLProgram;
    texCoordBuffer: WebGLBuffer;
    vertexBuffer: WebGLBuffer;
    vao: WebGLVertexArrayObject;
    texture: WebGLTexture;
}

export abstract class SimpleQuadRenderable implements PxlsExtendedBoardRenderable {
    readonly name: string;
    readonly title: string;

    private readonly rect: DOMRect;
    private readonly textureBufferData: Uint32Array;
    // todo: instead of this, maybe use update regions that get triggered whenever the texture is changed in that region...
    //  then we can update only those regions and save some memory bandwith
    private textureChangedSinceLastRender = true;

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

    // private texCoordBuffer: WebGLBuffer | null = null;
    // private vertexBuffer: WebGLBuffer | null = null;
    // private vao: WebGLVertexArrayObject | null = null;
    // private program: WebGLProgram | null = null;

    private persistentState: PersistentCanvasLayerState | null = null;

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
        const program = createProgram(ctx, vertexShader, fragmentShader);

        this.persistentState = {
            program,
            texCoordBuffer: ctx.createBuffer(),
            vertexBuffer: ctx.createBuffer(),
            vao: ctx.createVertexArray(),
            texture: ctx.createTexture(),
        };
    }

    render(ctx: WebGL2RenderingContext, boardCtx: BoardRenderingContext): void {
        if (this.persistentState == null) {
            console.warn(`Render layer "${this.name}" not initialized, this should never happen`);
            return;
        }

        const { program, vertexBuffer, vao } = this.persistentState;

        ctx.bindVertexArray(vao);

        // todo: set uniforms
        this.bindVertexBuffer(ctx, this.persistentState, 'a_position');
        this.bindTexCoordBuffer(ctx, this.persistentState, 'a_texCoord');
        this.bindTextureData(ctx, this.persistentState);

        // todo: draw call
        ctx.useProgram(program);
        ctx.bindVertexArray(vao);
        this.fillVertexBuffer(ctx, vertexBuffer);
        ctx.drawArrays(ctx.TRIANGLES, 0, 6);

        ctx.bindVertexArray(null);
        ctx.deleteVertexArray(vao);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        this.unbindTextureData(ctx);
        ctx.useProgram(null);
    }

    destroy(ctx: WebGL2RenderingContext): void {
        if (this.persistentState == null) {
            return;
        }
        ctx.deleteProgram(this.persistentState.program);
        ctx.deleteBuffer(this.persistentState.vertexBuffer);
        ctx.deleteBuffer(this.persistentState.texCoordBuffer);
        ctx.deleteVertexArray(this.persistentState.vao);
        this.persistentState = null;
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

    private bindVertexBuffer(
        ctx: WebGL2RenderingContext,
        state: PersistentCanvasLayerState,
        attributeName: string,
    ): void {
        const location = ctx.getAttribLocation(state.program, attributeName);
        ctx.enableVertexAttribArray(location);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, state.vertexBuffer);
        ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 0, 0);
    }

    private fillVertexBuffer(ctx: WebGL2RenderingContext, buffer: WebGLBuffer): void {
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, this.vertexBufferData, ctx.DYNAMIC_DRAW);
    }

    private bindTexCoordBuffer(
        ctx: WebGL2RenderingContext,
        state: PersistentCanvasLayerState,
        attributeName: string,
    ): void {
        const location = ctx.getAttribLocation(state.program, attributeName);
        ctx.enableVertexAttribArray(location);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, state.texCoordBuffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, this.texCoordBufferData, ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 0, 0);
    }

    private bindTextureData(ctx: WebGL2RenderingContext, state: PersistentCanvasLayerState): void {
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, state.texture);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
    }

    private fillFullTexture(ctx: WebGL2RenderingContext, texture: WebGLTexture): void {
        if (!this.textureChangedSinceLastRender) {
            return;
        }
        ctx.bindTexture(ctx.TEXTURE_2D, texture);
        ctx.texImage2D(
            ctx.TEXTURE_2D,
            0,
            ctx.RGBA,
            this.rect.width,
            this.rect.height,
            0,
            ctx.RGBA,
            ctx.UNSIGNED_BYTE,
            this.textureBufferData,
        );
        this.textureChangedSinceLastRender = false;
    }

    private unbindTextureData(ctx: WebGL2RenderingContext): void {
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, null);
    }
}
