import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { spawnHouses } from '../src/core/worldgen/houses';
import { CollisionSystem } from '../src/systems/collisionSystem';

describe('housing world generation', () => {
  it('is deterministic for same seed and config', () => {
    const a = createWorld(91, {
      housesEnabled: true,
      houseCount: 7,
      houseSize: 28,
      houseMinSpacing: 14,
      allowTriangularForts: true,
      allowSquareHouses: true,
      townPopulation: 5000,
    });
    const b = createWorld(91, {
      housesEnabled: true,
      houseCount: 7,
      houseSize: 28,
      houseMinSpacing: 14,
      allowTriangularForts: true,
      allowSquareHouses: true,
      townPopulation: 5000,
    });

    const createdA = spawnHouses(a, a.rng, a.config);
    const createdB = spawnHouses(b, b.rng, b.config);
    expect(createdA.length).toBe(createdB.length);

    for (let i = 0; i < createdA.length; i += 1) {
      const houseAId = createdA[i];
      const houseBId = createdB[i];
      if (houseAId === undefined || houseBId === undefined) {
        continue;
      }
      const transformA = a.transforms.get(houseAId);
      const transformB = b.transforms.get(houseBId);
      const houseA = a.houses.get(houseAId);
      const houseB = b.houses.get(houseBId);
      expect(transformA?.position.x ?? 0).toBeCloseTo(transformB?.position.x ?? 0, 8);
      expect(transformA?.position.y ?? 0).toBeCloseTo(transformB?.position.y ?? 0, 8);
      expect(houseA?.houseKind).toBe(houseB?.houseKind);
      expect(houseA?.polygon.verticesLocal).toEqual(houseB?.polygon.verticesLocal);
      expect(houseA?.doorEast.localMidpoint).toEqual(houseB?.doorEast.localMidpoint);
      expect(houseA?.doorWest.localMidpoint).toEqual(houseB?.doorWest.localMidpoint);
    }
  });

  it('houses participate in collision broad-phase/narrow-phase', () => {
    const world = createWorld(92, {
      housesEnabled: true,
      houseCount: 1,
      houseSize: 30,
      houseMinSpacing: 0,
    });
    const [houseId] = spawnHouses(world, world.rng, world.config);
    if (houseId === undefined) {
      throw new Error('Expected one house to be spawned.');
    }
    const houseTransform = world.transforms.get(houseId);
    if (!houseTransform) {
      throw new Error('Missing house transform.');
    }

    const moverId = spawnEntity(
      world,
      { kind: 'circle', size: 16 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      houseTransform.position,
    );
    expect(moverId).toBeGreaterThan(0);

    new CollisionSystem().update(world, 1 / world.config.tickRate);
    const collidedWithHouse = world.collisions.some(
      (pair) =>
        (pair.a === houseId && pair.b === moverId) || (pair.a === moverId && pair.b === houseId),
    );
    expect(collidedWithHouse).toBe(true);
  });
});
