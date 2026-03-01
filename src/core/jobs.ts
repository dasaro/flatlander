import type { RankComponent } from './rank';
import { Rank, RankTag } from './rank';
import type { ShapeComponent } from './shapes';
import type { JobKind } from './components';
import type { World } from './world';

const HASH_CONST = 0x9e3779b1;

function hash32(seed: number): number {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function pickByHash<T>(arr: readonly T[], seed: number): T {
  const index = arr.length <= 1 ? 0 : hash32(seed) % arr.length;
  const value = arr[index];
  if (value === undefined) {
    throw new Error('Cannot assign job from empty candidate set.');
  }
  return value;
}

export function allowedJobsFor(rank: RankComponent, shape: ShapeComponent): JobKind[] {
  switch (rank.rank) {
    case Rank.Woman:
      return ['Lady'];
    case Rank.Priest:
      return ['Priest'];
    case Rank.NearCircle:
      return ['Statesman', 'Noble'];
    case Rank.Noble:
      return ['Noble', 'Statesman'];
    case Rank.Gentleman:
      if (shape.kind === 'polygon' && shape.sides === 5) {
        return ['Physician', 'Merchant', 'Gentleman'];
      }
      if (shape.kind === 'polygon' && shape.sides === 4) {
        return ['Lawyer', 'Gentleman'];
      }
      return ['Gentleman'];
    case Rank.Triangle:
      if (rank.tags.includes(RankTag.Isosceles)) {
        return ['Soldier', 'Workman'];
      }
      return ['Merchant', 'Workman'];
    case Rank.Irregular:
      return ['Workman'];
    default:
      return ['Workman'];
  }
}

export function deterministicJobForEntity(
  worldSeed: number,
  entityId: number,
  rank: RankComponent,
  shape: ShapeComponent,
): JobKind {
  const choices = allowedJobsFor(rank, shape);
  return pickByHash(choices, worldSeed ^ Math.imul(entityId, HASH_CONST));
}

export function ensureCoherentJobForEntity(world: World, entityId: number): void {
  const rank = world.ranks.get(entityId);
  const shape = world.shapes.get(entityId);
  if (!rank || !shape) {
    world.jobs.delete(entityId);
    return;
  }
  const nextJob = deterministicJobForEntity(world.seed, entityId, rank, shape);
  world.jobs.set(entityId, { job: nextJob });
}
