import { describe, expect, it } from 'vitest';

import { deterministicJobForEntity, allowedJobsFor } from '../src/core/jobs';
import { Rank, RankTag, type RankComponent } from '../src/core/rank';
import type { ShapeComponent } from '../src/core/shapes';

function buildRank(rank: Rank, tags: RankTag[] = []): RankComponent {
  return { rank, tags };
}

describe('deterministic jobs', () => {
  it('returns deterministic job for same seed/entity/rank/shape', () => {
    const rank = buildRank(Rank.Gentleman);
    const shape: ShapeComponent = {
      kind: 'polygon',
      sides: 4,
      vertices: [],
      irregularity: 0,
      regular: true,
      boundingRadius: 12,
    };
    const a = deterministicJobForEntity(42, 101, rank, shape);
    const b = deterministicJobForEntity(42, 101, rank, shape);
    expect(a).toBe(b);
  });

  it('assigns jobs compatible with rank rules', () => {
    const cases: Array<{ rank: RankComponent; shape: ShapeComponent }> = [
      {
        rank: buildRank(Rank.Woman),
        shape: { kind: 'segment', length: 24, boundingRadius: 12 },
      },
      {
        rank: buildRank(Rank.Triangle, [RankTag.Isosceles]),
        shape: {
          kind: 'polygon',
          sides: 3,
          triangleKind: 'Isosceles',
          isoscelesBaseRatio: 0.2,
          vertices: [],
          irregularity: 0,
          regular: true,
          boundingRadius: 12,
        },
      },
      {
        rank: buildRank(Rank.Priest),
        shape: { kind: 'circle', radius: 11, boundingRadius: 11 },
      },
    ];

    for (const [index, scenario] of cases.entries()) {
      const allowed = allowedJobsFor(scenario.rank, scenario.shape);
      const picked = deterministicJobForEntity(99, index + 1, scenario.rank, scenario.shape);
      expect(allowed.includes(picked)).toBe(true);
    }
  });
});

