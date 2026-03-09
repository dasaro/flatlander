import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { baseRatioFromBrainAngleDeg } from '../src/core/isosceles';
import { conceptionChanceForFather, determineMaleChildShapeFromParents } from '../src/core/reproduction/offspringPolicy';
import { createWorld } from '../src/core/world';

describe('reproduction canon laws', () => {
  it('applies the law of nature for regular polygon fathers', () => {
    const world = createWorld(801, {
      southAttractionEnabled: false,
      reproductionEnabled: true,
      maxPolygonSides: 20,
    });
    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const father = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const child = determineMaleChildShapeFromParents(world, mother, father);
    expect(child.kind).toBe('polygon');
    if (child.kind !== 'polygon') {
      throw new Error('Expected polygon child.');
    }
    expect(child.sides).toBe(5);
  });

  it('advances isosceles brain angle by 0.5 degrees per generation until regularity', () => {
    const world = createWorld(802, {
      southAttractionEnabled: false,
      reproductionEnabled: true,
    });
    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 140 },
    );
    const father = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 20,
        irregular: false,
        triangleKind: 'Isosceles',
        brainAngleDeg: 0.5,
      },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 140 },
    );
    world.brainAngles.set(father, { brainAngleDeg: 0.5 });

    const child = determineMaleChildShapeFromParents(world, mother, father);
    expect(child.kind).toBe('polygon');
    if (child.kind !== 'polygon') {
      throw new Error('Expected triangle child.');
    }
    expect(child.triangleKind).toBe('Isosceles');
    expect(child.brainAngleDeg).toBeCloseTo(1, 8);
    expect(child.isoscelesBaseRatio ?? 0).toBeCloseTo(baseRatioFromBrainAngleDeg(1), 8);
  });

  it('applies monotone fertility penalties to higher ranks', () => {
    const world = createWorld(804, {
      reproductionEnabled: true,
      conceptionChancePerTick: 0.008,
      highOrderThresholdSides: 12,
      highOrderConceptionPenaltyMultiplier: 2.4,
    });
    const order8 = spawnEntity(
      world,
      { kind: 'polygon', sides: 8, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 80, y: 80 },
    );
    const order12 = spawnEntity(
      world,
      { kind: 'polygon', sides: 12, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 110, y: 80 },
    );
    const order16 = spawnEntity(
      world,
      { kind: 'polygon', sides: 16, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 80 },
    );

    expect(conceptionChanceForFather(world, order8)).toBeGreaterThan(conceptionChanceForFather(world, order12));
    expect(conceptionChanceForFather(world, order12)).toBeGreaterThanOrEqual(
      conceptionChanceForFather(world, order16),
    );
  });
});
