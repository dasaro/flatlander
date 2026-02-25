import { describe, expect, it } from 'vitest';

import { buildDeterministicName } from '../src/core/names';
import { Rank } from '../src/core/rank';
import { createWorld } from '../src/core/world';

describe('deterministic display names', () => {
  it('returns the same name for the same seed+entityId', () => {
    const shape = {
      kind: 'polygon' as const,
      sides: 8,
      vertices: [],
      irregularity: 0,
      regular: true,
      boundingRadius: 16,
    };
    const a = buildDeterministicName(42, 115, Rank.Noble, shape);
    const b = buildDeterministicName(42, 115, Rank.Noble, shape);
    expect(a.displayName).toBe(b.displayName);
  });

  it('does not consume world rng state', () => {
    const worldA = createWorld(77);
    const worldB = createWorld(77);

    void buildDeterministicName(worldA.seed, 1, Rank.Woman, {
      kind: 'segment',
      length: 24,
      boundingRadius: 12,
    });
    void buildDeterministicName(worldA.seed, 2, Rank.Gentleman, {
      kind: 'polygon',
      sides: 4,
      vertices: [],
      irregularity: 0,
      regular: true,
      boundingRadius: 12,
    });
    void buildDeterministicName(worldA.seed, 3, Rank.Priest, {
      kind: 'circle',
      radius: 12,
      boundingRadius: 12,
    });

    expect(worldA.rng.next()).toBe(worldB.rng.next());
    expect(worldA.rng.next()).toBe(worldB.rng.next());
  });
});
