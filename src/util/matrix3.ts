// prettier-ignore
export type Matrix3 = [
    number, number, number,
    number, number, number,
    number, number, number,
];

function multiply(a: Matrix3, b: Matrix3): Matrix3 {
    return [
        b[0] * a[0] + b[1] * a[3] + b[2] * a[6],
        b[0] * a[1] + b[1] * a[4] + b[2] * a[7],
        b[0] * a[2] + b[1] * a[5] + b[2] * a[8],
        b[3] * a[0] + b[4] * a[3] + b[5] * a[6],
        b[3] * a[1] + b[4] * a[4] + b[5] * a[7],
        b[3] * a[2] + b[4] * a[5] + b[5] * a[8],
        b[6] * a[0] + b[7] * a[3] + b[8] * a[6],
        b[6] * a[1] + b[7] * a[4] + b[8] * a[7],
        b[6] * a[2] + b[7] * a[5] + b[8] * a[8],
    ];
}

export function getProjectionMatrix(screenSpaceWidth: number, screenSpaceHeight: number): Matrix3 {
    // prettier-ignore
    return [
        2 / screenSpaceWidth, 0, 0,
        0, -2 / screenSpaceHeight, 0,
        -1, 1, 1,
    ];
}

function getCanvasTransformMatrix(tx: number, ty: number, scale: number): Matrix3 {
    // prettier-ignore
    return [
        scale, 0,     0,
        0,     scale, 0,
        tx,    ty,    1,
    ] satisfies Matrix3;
}

export function applyCanvasTransform(m: Matrix3, tx: number, ty: number, scale: number): Matrix3 {
    // prettier-ignore
    const transformationMatrix = [
        scale, 0,     0,
        0,     scale, 0,
        tx,    ty,    1,
    ] satisfies Matrix3;
    return multiply(m, transformationMatrix);
}

export function getUniformMatrix(
    canvasWidth: number,
    canvasHeight: number,
    tx: number,
    ty: number,
    scale: number,
): Matrix3 {
    const projectionMatrix = getProjectionMatrix(canvasWidth, canvasHeight);
    const canvasTransformMatrix = getCanvasTransformMatrix(tx, ty, scale);
    return multiply(projectionMatrix, canvasTransformMatrix);
}
