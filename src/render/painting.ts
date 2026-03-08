import { Rank } from '../core/rank';
import type { ShapeComponent } from '../core/shapes';
import type { World } from '../core/world';
import { resolveEntityStrokeColor } from './entityStyle';

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

export const HOUSE_STROKE_COLOR = '#2e2b25';
export const BOUNDARY_STROKE_COLOR = '#8d8778';

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

export function flatlanderStrokeColorsForHit(
  world: World,
  hitId: number | null,
): { strokeColor: string | null; monochromeStrokeColor: string | null; paintColor: string | null } {
  if (hitId === null) {
    return {
      strokeColor: null,
      monochromeStrokeColor: null,
      paintColor: null,
    };
  }
  if (hitId < 0) {
    return {
      strokeColor: BOUNDARY_STROKE_COLOR,
      monochromeStrokeColor: BOUNDARY_STROKE_COLOR,
      paintColor: null,
    };
  }
  if (world.houses.has(hitId)) {
    return {
      strokeColor: HOUSE_STROKE_COLOR,
      monochromeStrokeColor: HOUSE_STROKE_COLOR,
      paintColor: null,
    };
  }

  const shape = world.shapes.get(hitId);
  if (!shape) {
    return {
      strokeColor: null,
      monochromeStrokeColor: null,
      paintColor: null,
    };
  }

  const rank = world.ranks.get(hitId);
  const fillColor = rank ? monochromeFillForRank(rank.rank) : '#a8a092';
  const pregnantFillColor = shape.kind === 'segment' && world.pregnancies.has(hitId) ? '#b6afa3' : null;
  const paintColor = paintedStrokeColorForEntity(world.seed, hitId, shape);
  const monochromeStrokeColor = resolveEntityStrokeColor({
    fillColor,
    pregnantFillColor,
    strokeByKills: false,
    killStrokeColor: monochromeKillStrokeForCount(0),
    allowColor: false,
    paintStrokeColor: paintColor,
    isSelected: false,
    isHovered: false,
  });
  const strokeColor = resolveEntityStrokeColor({
    fillColor,
    pregnantFillColor,
    strokeByKills: false,
    killStrokeColor: monochromeKillStrokeForCount(0),
    allowColor: world.config.colorEnabled,
    paintStrokeColor: paintColor,
    isSelected: false,
    isHovered: false,
  });

  return {
    strokeColor,
    monochromeStrokeColor,
    paintColor,
  };
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
