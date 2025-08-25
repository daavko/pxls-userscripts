// prettier-ignore
export type Matrix3 = [
    number, number, number,
    number, number, number,
    number, number, number,
];

function multiply(a: Matrix3, b: Matrix3): Matrix3 {
    return [
        b[0] * a[0] + b[1] * a[3] + b[2] * a[2 * 3],
        b[0] * a[1] + b[1] * a[3 + 1] + b[2] * a[2 * 3 + 1],
        b[0] * a[2] + b[1] * a[3 + 2] + b[2] * a[2 * 3 + 2],
        b[3] * a[0] + b[3 + 1] * a[3] + b[3 + 2] * a[2 * 3],
        b[3] * a[1] + b[3 + 1] * a[3 + 1] + b[3 + 2] * a[2 * 3 + 1],
        b[3] * a[2] + b[3 + 1] * a[3 + 2] + b[3 + 2] * a[2 * 3 + 2],
        b[2 * 3] * a[0] + b[2 * 3 + 1] * a[3] + b[2 * 3 + 2] * a[2 * 3],
        b[2 * 3] * a[1] + b[2 * 3 + 1] * a[3 + 1] + b[2 * 3 + 2] * a[2 * 3 + 1],
        b[2 * 3] * a[2] + b[2 * 3 + 1] * a[3 + 2] + b[2 * 3 + 2] * a[2 * 3 + 2],
    ];
}

export function getProjectionMatrix(width: number, height: number): Matrix3 {
    // prettier-ignore
    return [
        2 / width, 0, 0,
        0, -2 / height, 0,
        -1, 1, 1,
    ];
}

export function applyCanvasTransform(m: Matrix3, tx: number, ty: number, scale: number): Matrix3 {
    // prettier-ignore
    const transformationMatrix = [
        scale, 0, 0,
        0, scale, 0,
        tx, ty, 1,
    ] satisfies Matrix3;
    return multiply(m, transformationMatrix);
}
