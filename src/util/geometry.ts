export interface Point {
    x: number;
    y: number;
}

// export function pointsDistance(x1: number, y1: number, x2: number, y2: number): number {
//     return Math.hypot(x2 - x1, y2 - y1);
// }

export function pointsDistance(p1: Point, p2: Point): number {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

export function midpoint(p1: Point, p2: Point): Point {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
    };
}
