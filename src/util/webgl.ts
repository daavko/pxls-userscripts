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
