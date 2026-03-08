import { Rank } from '../core/rank';
import type { ShapeComponent } from '../core/shapes';

const MONOCHROME_FILL_BY_RANK: Record<Rank, string> = {
  [Rank.Woman]: '#c7c1b7',
  [Rank.Triangle]: '#a8a092',
  [Rank.Gentleman]: '#b4ad9f',
  [Rank.Noble]: '#958c7b',
  [Rank.NearCircle]: '#81796a',
  [Rank.Priest]: '#d6d1c7',
  [Rank.Irregular]: '#7f7667',
};

const MONOCHROME_KILL_STROKES = ['#3f3a33', '#595147', '#6d6457', '#1b1712'] as const;
const PAINT_PALETTE = [
  '#2f5e97',
  '#8f4330',
  '#3e7e58',
  '#7a5d1e',
  '#6a4f92',
  '#1f6e69',
  '#945260',
  '#4f6e2b',
] as const;

export function monochromeFillForRank(rank: Rank): string {
  return MONOCHROME_FILL_BY_RANK[rank] ?? '#a8a092';
}

export function monochromeKillStrokeForCount(kills: number): string {
  if (kills <= 0) {
    return MONOCHROME_KILL_STROKES[0];
  }
  if (kills <= 2) {
    return MONOCHROME_KILL_STROKES[1];
  }
  if (kills <= 5) {
    return MONOCHROME_KILL_STROKES[2];
  }
  return MONOCHROME_KILL_STROKES[3];
}

export function isPaintingEligible(shape: ShapeComponent): boolean {
  // Flatland Part I §8: in the painting regime, ordinary polygons may be painted,
  // while women and priests remain colourless.
  return shape.kind === 'polygon';
}

export function paintedStrokeColorForEntity(
  seed: number,
  entityId: number,
  shape: ShapeComponent,
): string | null {
  if (!isPaintingEligible(shape)) {
    return null;
  }
  const hash = hashSeededEntity(seed, entityId);
  return PAINT_PALETTE[hash % PAINT_PALETTE.length] ?? null;
}

function hashSeededEntity(seed: number, entityId: number): number {
  let value = (seed ^ Math.imul(entityId + 1, 0x9e3779b1)) >>> 0;
  value ^= value >>> 16;
  value = Math.imul(value, 0x85ebca6b) >>> 0;
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35) >>> 0;
  value ^= value >>> 16;
  return value >>> 0;
}
