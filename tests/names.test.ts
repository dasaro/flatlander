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

  it('produces unique display names across entity ids in one world seed', () => {
    const shape = {
      kind: 'polygon' as const,
      sides: 6,
      vertices: [],
      irregularity: 0,
      regular: true,
      boundingRadius: 16,
    };
    const names = new Set<string>();
    for (let id = 1; id <= 600; id += 1) {
      const name = buildDeterministicName(42, id, Rank.Gentleman, shape);
      names.add(name.displayName);
    }
    expect(names.size).toBe(600);
  });

  it('builds a varied name pool from deterministic syllable composition', () => {
    const shape = {
      kind: 'polygon' as const,
      sides: 5,
      vertices: [],
      irregularity: 0,
      regular: true,
      boundingRadius: 16,
    };
    const given = new Set<string>();
    const family = new Set<string>();
    const suffixes = new Set<string>();
    for (let id = 1; id <= 900; id += 1) {
      const name = buildDeterministicName(99, id, Rank.Gentleman, shape);
      given.add(name.given);
      family.add(name.family);
      suffixes.add(name.suffix);
    }

    expect(given.size).toBeGreaterThan(120);
    expect(family.size).toBeGreaterThan(120);
    expect(suffixes.size).toBe(900);
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
