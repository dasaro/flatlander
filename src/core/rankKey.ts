import type { World } from './world';
import { Rank } from './rank';

export type RankKey =
  | 'Woman:Low'
  | 'Woman:Middle'
  | 'Woman:High'
  | 'Triangle:Isosceles'
  | 'Triangle:Equilateral'
  | 'Gentleman'
  | 'Noble'
  | 'NearCircle'
  | 'Priest'
  | 'Irregular'
  | 'Unknown';

export const KNOWN_RANK_KEYS: RankKey[] = [
  'Woman:Low',
  'Woman:Middle',
  'Woman:High',
  'Triangle:Isosceles',
  'Triangle:Equilateral',
  'Gentleman',
  'Noble',
  'NearCircle',
  'Priest',
  'Irregular',
  'Unknown',
];

export function rankKeyForEntity(world: World, entityId: number): RankKey {
  const rank = world.ranks.get(entityId);
  const shape = world.shapes.get(entityId);
  if (!rank || !shape) {
    return 'Unknown';
  }

  if (rank.rank === Rank.Woman) {
    const status = world.femaleStatus.get(entityId)?.femaleRank ?? 'Middle';
    if (status === 'Low') {
      return 'Woman:Low';
    }
    if (status === 'High') {
      return 'Woman:High';
    }
    return 'Woman:Middle';
  }

  if (rank.rank === Rank.Triangle && shape.kind === 'polygon') {
    return shape.triangleKind === 'Isosceles' ? 'Triangle:Isosceles' : 'Triangle:Equilateral';
  }

  if (rank.rank === Rank.Gentleman) {
    return 'Gentleman';
  }
  if (rank.rank === Rank.Noble) {
    return 'Noble';
  }
  if (rank.rank === Rank.NearCircle) {
    return 'NearCircle';
  }
  if (rank.rank === Rank.Priest) {
    return 'Priest';
  }
  if (rank.rank === Rank.Irregular) {
    return 'Irregular';
  }

  return 'Unknown';
}
