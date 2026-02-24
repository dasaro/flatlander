import { describe, expect, it } from 'vitest';

import type { KnownInfo } from '../src/core/components';
import { Rank } from '../src/core/rank';
import { contactCurveControlPoint, selectTopKnownIds } from '../src/render/contactNetwork';

describe('contact network known selection', () => {
  it('selects top known ids deterministically by learned tick, distance, then id', () => {
    const known = new Map<number, KnownInfo>([
      [9, { rank: Rank.Noble, learnedBy: 'feeling', learnedAtTick: 14 }],
      [4, { rank: Rank.Triangle, learnedBy: 'feeling', learnedAtTick: 20 }],
      [2, { rank: Rank.Gentleman, learnedBy: 'feeling', learnedAtTick: 20 }],
      [7, { rank: Rank.Woman, learnedBy: 'feeling', learnedAtTick: 20 }],
    ]);

    const positions = new Map<number, { x: number; y: number }>([
      [2, { x: 110, y: 100 }],
      [4, { x: 112, y: 100 }],
      [7, { x: 110, y: 100 }],
      [9, { x: 106, y: 100 }],
    ]);

    const selected = { x: 100, y: 100 };
    const ids = selectTopKnownIds(known, positions, selected, 4, 1_000);

    // Tick 20 entries first, then by distance, and stable tie-break by id (2 before 7).
    expect(ids).toEqual([2, 7, 4, 9]);
  });

  it('applies focus radius and edge cap', () => {
    const known = new Map<number, KnownInfo>([
      [1, { rank: Rank.Woman, learnedBy: 'feeling', learnedAtTick: 5 }],
      [2, { rank: Rank.Woman, learnedBy: 'feeling', learnedAtTick: 4 }],
      [3, { rank: Rank.Woman, learnedBy: 'feeling', learnedAtTick: 3 }],
    ]);
    const positions = new Map<number, { x: number; y: number }>([
      [1, { x: 10, y: 0 }],
      [2, { x: 25, y: 0 }],
      [3, { x: 50, y: 0 }],
    ]);

    const selected = { x: 0, y: 0 };
    const ids = selectTopKnownIds(known, positions, selected, 2, 30);
    expect(ids).toEqual([1, 2]);
  });

  it('computes deterministic curve control points for the same ids and endpoints', () => {
    const from = { x: 120, y: 100 };
    const to = { x: 260, y: 160 };
    const first = contactCurveControlPoint(from, to, 11, 27);
    const second = contactCurveControlPoint(from, to, 11, 27);
    const swapped = contactCurveControlPoint(from, to, 27, 11);

    expect(first).toEqual(second);
    expect(Number.isFinite(first.x)).toBe(true);
    expect(Number.isFinite(first.y)).toBe(true);
    expect(swapped).not.toEqual(first);
  });
});
