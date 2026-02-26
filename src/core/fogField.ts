import { clamp } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { World } from './world';

export interface FogFieldConfig {
  seed: number;
  width: number;
  height: number;
  baseDensity: number;
  cellSize: number;
  variation: number;
  torridStartFrac: number;
  torridRelief: number;
}

function hash32(input: number): number {
  let x = input | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function hashCell(seed: number, cellX: number, cellY: number): number {
  const mixed =
    seed ^
    Math.imul(cellX | 0, 0x9e3779b1) ^
    Math.imul(cellY | 0, 0x85ebca77) ^
    0x7f4a7c15;
  return hash32(mixed) / 0xffffffff;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function cellMultiplier(config: FogFieldConfig, cellX: number, cellY: number): number {
  const n = hashCell(config.seed, cellX, cellY) * 2 - 1;
  return 1 + n * clamp(config.variation, 0, 0.95);
}

function torridMultiplier(config: FogFieldConfig, y: number): number {
  const height = Math.max(1, config.height);
  const start = clamp(config.torridStartFrac, 0, 1) * height;
  if (y <= start) {
    return 1;
  }
  const southNorm = clamp((y - start) / Math.max(1, height - start), 0, 1);
  const relief = clamp(config.torridRelief, 0, 0.9);
  return 1 - relief * smooth01(southNorm);
}

export function fogFieldConfigFromWorld(world: World): FogFieldConfig {
  return {
    seed: world.seed,
    width: world.config.width,
    height: world.config.height,
    baseDensity: Math.max(0, world.config.fogDensity),
    cellSize: Math.max(16, world.config.fogFieldCellSize),
    variation: Math.max(0, world.config.fogFieldVariation),
    torridStartFrac: world.config.fogTorridZoneStartFrac,
    torridRelief: world.config.fogTorridZoneRelief,
  };
}

export function fogDensityAt(config: FogFieldConfig, pos: Vec2): number {
  const base = Math.max(0, config.baseDensity);
  if (base <= 0) {
    return 0;
  }
  const cellSize = Math.max(1, config.cellSize);
  const x = pos.x / cellSize;
  const y = pos.y / cellSize;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;

  const m00 = cellMultiplier(config, x0, y0);
  const m10 = cellMultiplier(config, x0 + 1, y0);
  const m01 = cellMultiplier(config, x0, y0 + 1);
  const m11 = cellMultiplier(config, x0 + 1, y0 + 1);
  const mx0 = lerp(m00, m10, smooth01(tx));
  const mx1 = lerp(m01, m11, smooth01(tx));
  const local = lerp(mx0, mx1, smooth01(ty));
  const zonal = torridMultiplier(config, pos.y);
  return Math.max(0, base * local * zonal);
}

