import {
    type BoardRenderingContext,
    type ChangedRegionDefinition,
    type PxlsExtendedBoardRenderable,
    Renderable,
    type RenderableTextureData,
} from '../pxls/pxls-modules-ext';

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

abstract class NewQuadRenderable extends Renderable {
    protected _rect: DOMRect;

    private readonly vertexBuffer: WebGLBuffer;
    private vertexBufferData: Float32Array;
    private readonly vao: WebGLVertexArrayObject;
    private readonly texCoordBuffer: WebGLBuffer;
    private readonly texCoordBufferData = new Float32Array([
        0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0,
    ]);

    protected abstract activeProgram: WebGLProgram;

    protected constructor(gl: WebGL2RenderingContext, rect: DOMRect) {
        super(gl);

        // copy to avoid external mutations
        this._rect = DOMRect.fromRect(rect);
        this.vertexBuffer = gl.createBuffer();
        this.vertexBufferData = this.createVertexBufferData();
        this.vao = gl.createVertexArray();
        this.texCoordBuffer = gl.createBuffer();
    }

    get rect(): DOMRectReadOnly {
        return this._rect;
    }

    set x(value: number) {
        this._rect.x = value;
        this.updateVertexBufferData();
    }

    set y(value: number) {
        this._rect.y = value;
        this.updateVertexBufferData();
    }

    protected set width(value: number) {
        this._rect.width = value;
        this.updateVertexBufferData();
    }

    protected set height(value: number) {
        this._rect.height = value;
        this.updateVertexBufferData();
    }

    override render(projectionMatrixUniform: Float32Array): void {
        this.prepareRenderingContext(projectionMatrixUniform);

        const { gl } = this;
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        this.teardownRenderingContext();
    }

    override destroy(gl: WebGL2RenderingContext): void {
        gl.deleteProgram(this.activeProgram);
        gl.deleteBuffer(this.vertexBuffer);
        gl.deleteBuffer(this.texCoordBuffer);
        gl.deleteVertexArray(this.vao);
    }

    protected createProgram(vertexShaderSource: string, fragmentShaderSource: string): WebGLProgram {
        const vertexShader = compileShader(this.gl, vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = compileShader(this.gl, fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        return createProgram(this.gl, vertexShader, fragmentShader);
    }

    protected prepareRenderingContext(projectionMatrixUniform: Float32Array): void {
        const { activeProgram, gl, vao } = this;

        gl.bindVertexArray(vao);
        this.bindBuffers();

        gl.useProgram(activeProgram);
        gl.bindVertexArray(vao);
        this.fillBufferData();
        this.setUniforms(projectionMatrixUniform);
    }

    protected teardownRenderingContext(): void {
        const { gl } = this;

        this.unbindBuffers();
        gl.useProgram(null);
    }

    protected bindBuffers(): void {
        const { activeProgram, gl, vertexBuffer, texCoordBuffer } = this;

        const positionLocation = gl.getAttribLocation(activeProgram, 'a_position');
        const texCoordLocation = gl.getAttribLocation(activeProgram, 'a_texCoord');

        gl.enableVertexAttribArray(positionLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        gl.enableVertexAttribArray(texCoordLocation);
        gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.texCoordBufferData, gl.STATIC_DRAW);
        gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0);
    }

    protected unbindBuffers(): void {
        const { gl } = this;
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    protected fillBufferData(): void {
        const { gl, vertexBuffer } = this;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.vertexBufferData, gl.DYNAMIC_DRAW);
    }

    protected setUniforms(projectionMatrixUniform: Float32Array): void {
        const { activeProgram, gl } = this;
        const projectionMatrixLocation = gl.getUniformLocation(activeProgram, 'u_matrix');
        gl.uniformMatrix3fv(projectionMatrixLocation, false, projectionMatrixUniform);
    }

    private createVertexBufferData(): Float32Array {
        const { left: x1, top: y1, right: x2, bottom: y2 } = this.rect;
        return new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]);
    }

    private updateVertexBufferData(): void {
        this.vertexBufferData = this.createVertexBufferData();
    }
}

export abstract class NewSimpleQuadRenderable extends NewQuadRenderable {
    private readonly texture: WebGLTexture;
    private readonly dataProvider: RenderableTextureData<Uint32Array>;
    private textureInitialized = false;

    protected constructor(gl: WebGL2RenderingContext, rect: DOMRect, dataProvider: RenderableTextureData<Uint32Array>) {
        super(gl, rect);

        this.texture = gl.createTexture();
        this.dataProvider = dataProvider;
    }

    protected override bindBuffers(): void {
        super.bindBuffers();

        const { gl, texture } = this;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }

    protected override unbindBuffers(): void {
        const { gl } = this;
        gl.bindTexture(gl.TEXTURE_2D, null);
        super.unbindBuffers();
    }

    protected override fillBufferData(): void {
        super.fillBufferData();
        if (!this.textureInitialized) {
            this.fillFullTextureData(this.gl);
            return;
        }

        const changed = this.dataProvider.dataChanged;
        if (typeof changed === 'boolean') {
            if (changed) {
                this.fillFullTextureData(this.gl);
            }
        } else {
            if (changed.length > 0) {
                this.fillPartialTextureData(this.gl, changed);
            }
        }
    }

    protected override setUniforms(projectionMatrixUniform: Float32Array): void {
        super.setUniforms(projectionMatrixUniform);

        const { activeProgram, gl } = this;
        const textureLocation = gl.getUniformLocation(activeProgram, 'u_texture');
        gl.uniform1i(textureLocation, 0);
    }

    private fillFullTextureData(gl: WebGL2RenderingContext): void {
        const data = this.dataProvider.data;
        if (data == null) {
            return;
        }

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            this.rect.width,
            this.rect.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            new Uint8Array(data.buffer),
        );
        this.textureInitialized = true;
    }

    private fillPartialTextureData(gl: WebGL2RenderingContext, changedRegions: ChangedRegionDefinition[]): void {
        const data = this.dataProvider.data;
        if (data == null) {
            return;
        }

        const glTextureView = new Uint8Array(data.buffer);
        for (const region of changedRegions) {
            let regionStart: number;
            let regionHeight: number;
            if (typeof region === 'number') {
                regionStart = region;
                regionHeight = 1;
            } else {
                [regionStart, regionHeight] = region;
            }
            const subView = this.createTextureSubview(glTextureView, regionStart, regionHeight);
            gl.texSubImage2D(
                gl.TEXTURE_2D,
                0,
                0,
                regionStart,
                this.rect.width,
                regionHeight,
                gl.RGBA,
                gl.UNSIGNED_BYTE,
                subView,
            );
        }
    }

    private createTextureSubview(textureData: Uint8Array, y: number, height: number): Uint8Array {
        return textureData.subarray(y * this.rect.width * 4, (y + height) * this.rect.width * 4);
    }
}

export interface PersistentQuadRenderableState {
    program: WebGLProgram;
    vertexBuffer: WebGLBuffer;
    vao: WebGLVertexArrayObject;
    texCoordBuffer: WebGLBuffer;
}

export interface PersistentSingleTextureState {
    texture: WebGLTexture;
}

export abstract class QuadRenderable implements PxlsExtendedBoardRenderable {
    readonly name: string;
    readonly title: string;

    protected readonly rect: DOMRect;

    protected persistentState: PersistentQuadRenderableState | null = null;

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

    protected abstract readonly vertexShaderSource: string;
    protected abstract readonly fragmentShaderSource: string;

    protected constructor(name: string, title: string, rect: DOMRect) {
        this.name = name;
        this.title = title;

        // copy to avoid external mutations
        this.rect = new DOMRect(rect.x, rect.y, rect.width, rect.height);
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

    get initialized(): boolean {
        return this.persistentState != null;
    }

    set x(value: number) {
        this.rect.x = value;
        this.updateVertexBufferData();
    }
    set y(value: number) {
        this.rect.y = value;
        this.updateVertexBufferData();
    }

    protected set width(value: number) {
        this.rect.width = value;
        this.updateVertexBufferData();
    }

    protected set height(value: number) {
        this.rect.height = value;
        this.updateVertexBufferData();
    }

    init(ctx: WebGL2RenderingContext): void {
        if (this.persistentState != null) {
            console.warn(`Render layer "${this.name}" already initialized, skipping`);
            return;
        }

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
        };
    }

    render(ctx: WebGL2RenderingContext, boardCtx: BoardRenderingContext): void {
        if (this.persistentState == null) {
            console.warn(`Render layer "${this.name}" not initialized, this should never happen`);
            return;
        }

        this.prepareRenderingContext(ctx, boardCtx, this.persistentState);
        ctx.drawArrays(ctx.TRIANGLES, 0, 6);
        this.teardownRenderingContext(ctx);
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

    protected prepareRenderingContext(
        ctx: WebGL2RenderingContext,
        boardCtx: BoardRenderingContext,
        state: PersistentQuadRenderableState,
    ): void {
        const { program, vertexBuffer, vao } = state;

        ctx.bindVertexArray(vao);

        this.bindVertexBuffer(ctx, state, 'a_position');
        this.bindTexCoordBuffer(ctx, state, 'a_texCoord');
        this.bindTextureData(ctx, state);

        ctx.useProgram(program);
        ctx.bindVertexArray(vao);
        this.fillVertexBuffer(ctx, vertexBuffer);
        this.fillTextureData(ctx);
        ctx.uniformMatrix3fv(ctx.getUniformLocation(program, 'u_matrix'), false, boardCtx.uniformMatrix);
        ctx.uniform1i(ctx.getUniformLocation(program, 'u_texture'), 0);
    }

    protected teardownRenderingContext(ctx: WebGL2RenderingContext): void {
        ctx.bindVertexArray(null);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, null);
        this.unbindTextureData(ctx);
        ctx.useProgram(null);
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
        state: PersistentQuadRenderableState,
        attributeName: string,
    ): void {
        const location = ctx.getAttribLocation(state.program, attributeName);
        ctx.enableVertexAttribArray(location);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, state.vertexBuffer);
        ctx.vertexAttribPointer(location, 2, ctx.FLOAT, false, 0, 0);
    }

    private fillVertexBuffer(ctx: WebGL2RenderingContext, buffer: WebGLBuffer): void {
        ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, this.vertexBufferData, ctx.DYNAMIC_DRAW);
    }

    private bindTexCoordBuffer(
        ctx: WebGL2RenderingContext,
        state: PersistentQuadRenderableState,
        attributeName: string,
    ): void {
        const location = ctx.getAttribLocation(state.program, attributeName);
        ctx.enableVertexAttribArray(location);
        ctx.bindBuffer(ctx.ARRAY_BUFFER, state.texCoordBuffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, this.texCoordBufferData, ctx.STATIC_DRAW);
        ctx.vertexAttribPointer(location, 2, ctx.FLOAT, false, 0, 0);
    }

    private unbindTextureData(ctx: WebGL2RenderingContext): void {
        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, null);
    }

    protected abstract bindTextureData(ctx: WebGL2RenderingContext, state: PersistentQuadRenderableState): void;
    protected abstract fillTextureData(ctx: WebGL2RenderingContext): void;
}

export abstract class SimpleQuadRenderable extends QuadRenderable {
    protected textureState: PersistentSingleTextureState | null = null;

    private textureInitialized = false;
    private readonly textureBufferData: Uint32Array;
    private readonly textureBufferWebGLView: Uint8Array;
    private readonly changedRows = new Set<number>();

    protected constructor(name: string, title: string, rect: DOMRect, textureBuffer?: Uint32Array) {
        super(name, title, rect);

        if (textureBuffer) {
            if (textureBuffer.length !== rect.width * rect.height) {
                throw new Error(
                    `Provided texture buffer size ${textureBuffer.length} does not match expected size of ${rect.width * rect.height}`,
                );
            }
            this.textureBufferData = new Uint32Array(textureBuffer);
        } else {
            this.textureBufferData = new Uint32Array(rect.width * rect.height);
        }
        this.textureBufferWebGLView = new Uint8Array(this.textureBufferData.buffer);
    }

    override init(ctx: WebGL2RenderingContext): void {
        if (this.textureState != null) {
            console.warn(`Render layer "${this.name}" already initialized, skipping`);
            return;
        }

        super.init(ctx);

        this.textureState = {
            texture: ctx.createTexture(),
        };
    }

    override destroy(ctx: WebGL2RenderingContext): void {
        if (this.textureState != null) {
            ctx.deleteTexture(this.textureState.texture);
            this.textureState = null;
        }
        super.destroy(ctx);
    }

    setPixel(x: number, y: number, color: number): void {
        const index = this.getIndex(x, y);
        if (index == null) {
            return;
        }
        this.textureBufferData[index] = color;
        this.addChangedRow(y);
    }

    setPixelByIndex(index: number, color: number): void {
        if (index < 0 || index >= this.textureBufferData.length) {
            return;
        }
        this.textureBufferData[index] = color;
        this.addChangedRow(Math.floor(index / this.rect.width));
    }

    getPixel(x: number, y: number): number | undefined {
        return this.textureBufferData.at(this.getIndexUnchecked(x, y));
    }

    getPixelByIndex(index: number): number | undefined {
        return this.textureBufferData.at(index);
    }

    protected getIndexUnchecked(x: number, y: number): number {
        return y * this.rect.width + x;
    }

    protected getIndex(x: number, y: number): number | null {
        if (x < 0 || x >= this.rect.width || y < 0 || y >= this.rect.height) {
            return null;
        }
        return this.getIndexUnchecked(x, y);
    }

    protected bindTextureData(ctx: WebGL2RenderingContext): void {
        if (this.textureState == null) {
            throw new Error(`Render layer "${this.name}" texture state not initialized, this should never happen`);
        }

        ctx.activeTexture(ctx.TEXTURE0);
        ctx.bindTexture(ctx.TEXTURE_2D, this.textureState.texture);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
        ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MAG_FILTER, ctx.NEAREST);
    }

    protected fillTextureData(ctx: WebGL2RenderingContext): void {
        if (this.textureInitialized && this.changedRows.size === 0) {
            return;
        }

        if (this.textureState == null) {
            throw new Error(`Render layer "${this.name}" texture state not initialized, this should never happen`);
        }

        ctx.bindTexture(ctx.TEXTURE_2D, this.textureState.texture);
        if (this.textureInitialized) {
            const changedRegions = this.collectChangedRegions();
            for (const region of changedRegions) {
                let regionStart: number;
                let regionHeight: number;
                let subView: Uint8Array;
                if (typeof region === 'number') {
                    regionStart = region;
                    regionHeight = 1;
                    subView = this.createTextureSubview(region, 1);
                } else {
                    regionStart = region[0];
                    regionHeight = region[1] - region[0] + 1;
                    subView = this.createTextureSubview(region[0], regionHeight);
                }
                ctx.texSubImage2D(
                    ctx.TEXTURE_2D,
                    0,
                    0,
                    regionStart,
                    this.rect.width,
                    regionHeight,
                    ctx.RGBA,
                    ctx.UNSIGNED_BYTE,
                    subView,
                );
            }
        } else {
            ctx.texImage2D(
                ctx.TEXTURE_2D,
                0,
                ctx.RGBA,
                this.rect.width,
                this.rect.height,
                0,
                ctx.RGBA,
                ctx.UNSIGNED_BYTE,
                this.textureBufferWebGLView,
            );
            this.textureInitialized = true;
            this.changedRows.clear();
        }
    }

    private createTextureSubview(y: number, height: number): Uint8Array {
        return this.textureBufferWebGLView.subarray(y * this.rect.width * 4, (y + height) * this.rect.width * 4);
    }

    private addChangedRow(y: number): void {
        this.changedRows.add(y);
    }

    private collectChangedRegions(): (number | [number, number])[] {
        const rows = Array.from(this.changedRows).sort((a, b) => a - b);

        const regions = rows.reduce<(number | [number, number])[]>((acc, value, index) => {
            if (index === 0) {
                acc.push(value);
                return acc;
            }
            const last = acc[acc.length - 1];
            if (typeof last === 'number') {
                if (value === last + 1) {
                    acc[acc.length - 1] = [last, value];
                } else {
                    acc.push(value);
                }
                return acc;
            } else {
                if (value === last[1] + 1) {
                    acc[acc.length - 1] = [last[0], value];
                } else {
                    acc.push(value);
                }
                return acc;
            }
        }, []);

        this.changedRows.clear();
        return regions;
    }
}
