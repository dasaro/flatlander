import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { rankKeyForEntity } from '../src/core/rankKey';
import { createWorld } from '../src/core/world';

describe('rankKeyForEntity', () => {
  it('maps woman female status and triangle subclasses correctly', () => {
    const world = createWorld(410);

    const woman = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    const isosceles = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 18,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.06,
      },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 100 },
    );
    const equilateral = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 18,
        irregular: false,
        triangleKind: 'Equilateral',
      },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 100 },
    );

    const womanStatus = world.femaleStatus.get(woman);
    if (!womanStatus) {
      throw new Error('Missing female status for woman entity.');
    }
    womanStatus.femaleRank = 'High';

    expect(rankKeyForEntity(world, woman)).toBe('Woman:High');
    expect(rankKeyForEntity(world, isosceles)).toBe('Triangle:Isosceles');
    expect(rankKeyForEntity(world, equilateral)).toBe('Triangle:Equilateral');
  });

  it('maps higher ranks and irregular correctly', () => {
    const world = createWorld(411);

    const gentleman = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 120 },
    );
    const noble = spawnEntity(
      world,
      { kind: 'polygon', sides: 6, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 120 },
    );
    const priest = spawnEntity(
      world,
      { kind: 'circle', size: 16 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 120 },
    );
    const irregular = spawnEntity(
      world,
      { kind: 'polygon', sides: 7, size: 20, irregular: true },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 220, y: 120 },
    );

    expect(rankKeyForEntity(world, gentleman)).toBe('Gentleman');
    expect(rankKeyForEntity(world, noble)).toBe('Noble');
    expect(rankKeyForEntity(world, priest)).toBe('Priest');
    expect(rankKeyForEntity(world, irregular)).toBe('Irregular');
  });
});
