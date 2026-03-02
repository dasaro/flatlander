import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { countPopulationByRank, resamplePopulationSamples } from '../src/render/populationHistogram';

describe('resamplePopulationSamples', () => {
  it('returns empty for empty input', () => {
    const sampled = resamplePopulationSamples([], 300);
    expect(sampled).toEqual([]);
  });

  it('does not introduce zero dips for constant populations', () => {
    const base = Array.from({ length: 180 }, (_, tick) => ({
      tick,
      population: 90,
      groups: [30, 20, 40, 0, 0, 0, 0, 0, 0],
    }));
    const sampled = resamplePopulationSamples(base, 640);
    expect(sampled.length).toBe(640);
    expect(sampled.every((point) => Math.abs(point.population - 90) < 1e-6)).toBe(true);
    expect(
      sampled.every(
        (point) => Math.abs(point.groups.reduce((sum, value) => sum + value, 0) - point.population) < 1e-5,
      ),
    ).toBe(true);
  });

  it('preserves endpoints when downsampling', () => {
    const base = Array.from({ length: 6 }, (_, tick) => ({
      tick,
      population: tick * 10,
      groups: [tick * 10, 0, 0, 0, 0, 0, 0, 0, 0],
    }));
    const sampled = resamplePopulationSamples(base, 3);
    expect(sampled[0]?.population).toBe(0);
    expect(Math.round(sampled[1]?.population ?? 0)).toBe(25);
    expect(sampled[2]?.population).toBe(50);
  });

  it('excludes static obstacles (houses) from population composition counts', () => {
    const world = createWorld(912);
    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 120 },
    );

    const houseId = world.nextEntityId++;
    world.entities.add(houseId);
    world.staticObstacles.set(houseId, { kind: 'house' });

    const counts = countPopulationByRank(world);
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

    expect(total).toBe(2);
    expect(counts.Unknown ?? 0).toBe(0);
  });
});
