/**
 * Height between -1.0 and 1.0:
 * [-1.00,-0.25) == deep water
 * [-0.25,+0.00) == shallow water
 * [+0.00,+0.25) == flat land
 * [+0.25,+0.75) == hills
 * [+0.75,+1.00] == mountains
 */
export type Height = number;

export interface TileData {
    q: number;
    r: number;
    height: Height;
    fog: boolean;
    clouds: boolean;
}

export function isLand(height: Height) {
    return height >= 0.0 && height < 0.75
}

export function isWater(height: Height) {
    return height < 0.0
}

export function isMountain(height: Height) {
    return height >= 0.75
}