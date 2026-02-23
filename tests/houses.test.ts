import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { spawnHouses, type HouseConfig } from '../src/core/worldgen/houses';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';

function snapshotHouses(seed: number, config: HouseConfig): string {
  const world = createWorld(seed, {
    width: 600,
    height: 400,
  });
  const houseIds = spawnHouses(world, world.rng, config);
  const rows = houseIds.map((id) => {
    const transform = world.transforms.get(id);
    const shape = world.shapes.get(id);
    const house = world.houses.get(id);
    return {
      id,
      x: Number((transform?.position.x ?? 0).toFixed(4)),
      y: Number((transform?.position.y ?? 0).toFixed(4)),
      sides: shape?.kind === 'polygon' ? shape.sides : null,
      houseKind: house?.houseKind ?? null,
      eastDoorX: Number((house?.doorEastWorld.x ?? 0).toFixed(4)),
      westDoorX: Number((house?.doorWestWorld.x ?? 0).toFixed(4)),
    };
  });

  return JSON.stringify(rows);
}

describe('house world generation', () => {
  it('is deterministic for same seed and config', () => {
    const config: HouseConfig = {
      housesEnabled: true,
      houseCount: 12,
      townPopulation: 5000,
      allowTriangularForts: true,
      allowSquareHouses: true,
      houseSize: 30,
    };

    const a = snapshotHouses(42, config);
    const b = snapshotHouses(42, config);
    expect(a).toBe(b);
  });

  it('disables square houses when population is large', () => {
    const world = createWorld(77, {
      width: 700,
      height: 500,
    });
    const ids = spawnHouses(world, world.rng, {
      housesEnabled: true,
      houseCount: 40,
      townPopulation: 10_000,
      allowTriangularForts: false,
      allowSquareHouses: true,
      houseSize: 28,
    });

    const kinds = ids
      .map((id) => world.houses.get(id)?.houseKind)
      .filter((value): value is NonNullable<typeof value> => value !== undefined);
    expect(kinds.every((kind) => kind !== 'Square')).toBe(true);
  });

  it('collides moving entities against houses', () => {
    const world = createWorld(11, {
      width: 400,
      height: 300,
    });
    const houseIds = spawnHouses(world, world.rng, {
      housesEnabled: true,
      houseCount: 1,
      townPopulation: 5000,
      allowTriangularForts: false,
      allowSquareHouses: false,
      houseSize: 36,
    });
    const houseId = houseIds[0];
    if (houseId === undefined) {
      throw new Error('House generation failed for collision smoke test.');
    }

    const houseTransform = world.transforms.get(houseId);
    if (!houseTransform) {
      throw new Error('House transform missing for collision smoke test.');
    }

    const moverId = spawnEntity(
      world,
      { kind: 'circle', size: 14 },
      { type: 'straightDrift', vx: 6, vy: 0, boundary: 'wrap' },
      { x: houseTransform.position.x, y: houseTransform.position.y },
    );

    const collision = new CollisionSystem();
    collision.update(world);

    const hasCollision = world.collisions.some(
      (pair) =>
        (pair.a === houseId && pair.b === moverId) || (pair.b === houseId && pair.a === moverId),
    );
    expect(hasCollision).toBe(true);
  });
});
