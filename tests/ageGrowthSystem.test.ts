import { describe, expect, it } from 'vitest';

import { createAdultGrowthComponent, applyGrowthToShape, growthScaleAtAge, resetEntityToNewborn } from '../src/core/growth';
import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { AgeGrowthSystem } from '../src/systems/ageGrowthSystem';

describe('age growth system', () => {
  it('keeps initial scenario-style spawns at adult size by default', () => {
    const world = createWorld(42, {
      ageSizeEnabled: true,
      growthBirthScale: 0.35,
      growthMaturityTicks: 120,
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });
    const id = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );

    const shape = world.shapes.get(id);
    if (!shape || shape.kind !== 'segment') {
      throw new Error('Expected spawned segment.');
    }
    const adultLength = shape.length;

    new AgeGrowthSystem().update(world, 1 / 30);
    expect(shape.length).toBeCloseTo(adultLength, 9);
  });

  it('grows newborn geometry monotonically toward adult size', () => {
    const world = createWorld(7, {
      ageSizeEnabled: true,
      growthBirthScale: 0.35,
      growthMaturityTicks: 10,
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });
    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );

    const shape = world.shapes.get(id);
    const growth = world.growth.get(id);
    if (!shape || shape.kind !== 'polygon' || !growth) {
      throw new Error('Expected spawned polygon with growth.');
    }

    const adultRadius = shape.boundingRadius;
    resetEntityToNewborn(growth);
    applyGrowthToShape(shape, growth);
    const newbornRadius = shape.boundingRadius;

    expect(newbornRadius).toBeLessThan(adultRadius);

    const system = new AgeGrowthSystem();
    system.update(world, 1 / 30);
    const juvenileRadius = shape.boundingRadius;
    expect(juvenileRadius).toBeGreaterThan(newbornRadius);

    for (let i = 0; i < 20; i += 1) {
      system.update(world, 1 / 30);
    }
    expect(shape.boundingRadius).toBeCloseTo(adultRadius, 6);
  });

  it('uses a clamped monotone size scale over the maturation window', () => {
    expect(growthScaleAtAge(0, 0.35, 120)).toBeCloseTo(0.35, 9);
    expect(growthScaleAtAge(60, 0.35, 120)).toBeGreaterThan(growthScaleAtAge(30, 0.35, 120));
    expect(growthScaleAtAge(120, 0.35, 120)).toBeCloseTo(1, 9);
    expect(growthScaleAtAge(300, 0.35, 120)).toBeCloseTo(1, 9);
  });

  it('can reset a growth component to a newborn stage without changing the adult baseline', () => {
    const shape = { kind: 'segment' as const, length: 20, boundingRadius: 10 };
    const growth = createAdultGrowthComponent(shape, 0.35, 90);
    resetEntityToNewborn(growth);
    expect(growth.growthTicks).toBe(0);
    expect(growth.adultSize).toBeCloseTo(20, 9);
  });
});
