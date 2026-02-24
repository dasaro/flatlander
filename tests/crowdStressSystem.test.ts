import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { crowdStressFromNeighborCount, CrowdStressSystem } from '../src/systems/crowdStressSystem';

describe('crowd stress system', () => {
  it('computes deterministic monotone stress from neighbor count', () => {
    const threshold = 6;
    expect(crowdStressFromNeighborCount(0, threshold)).toBe(0);
    expect(crowdStressFromNeighborCount(6, threshold)).toBe(0);
    expect(crowdStressFromNeighborCount(7, threshold)).toBeGreaterThan(0);
    expect(crowdStressFromNeighborCount(10, threshold)).toBeGreaterThan(
      crowdStressFromNeighborCount(7, threshold),
    );
  });

  it('does not apply crowd stress to indoors entities', () => {
    const world = createWorld(9001, {
      crowdStressEnabled: true,
      crowdStressRadius: 120,
      crowdStressThreshold: 1,
      crowdStressWearScale: 2.5,
      wearToHpStep: 2,
      southAttractionEnabled: false,
    });
    const indoors = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 240, y: 240 },
    );
    const neighborA = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 246, y: 242 },
    );
    const neighborB = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 234, y: 238 },
    );
    void neighborA;
    void neighborB;

    const dwelling = world.dwellings.get(indoors);
    if (!dwelling) {
      throw new Error('Missing dwelling for indoors stress test.');
    }
    dwelling.state = 'inside';
    dwelling.houseId = 1;
    dwelling.ticksInside = 10;
    dwelling.cooldownTicks = 0;

    const before = world.durability.get(indoors)?.wear ?? 0;
    new CrowdStressSystem().update(world, 1 / world.config.tickRate);
    const after = world.durability.get(indoors)?.wear ?? 0;
    expect(after).toBe(before);
  });
});
