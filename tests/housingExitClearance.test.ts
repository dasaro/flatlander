import { describe, expect, it } from 'vitest';

import { createHouseLayout, doorPoseWorld, houseComponentFromLayout, houseShapeFromLayout } from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { geometryFromComponents } from '../src/core/entityGeometry';
import { spawnEntity } from '../src/core/factory';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { HouseSystem } from '../src/systems/houseSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { distancePointToPolygonBoundary } from '../src/geometry/collisionManifold';

function addHouse(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const layout = createHouseLayout('Pentagon', 40);
  const houseId = world.nextEntityId;
  world.nextEntityId += 1;
  world.entities.add(houseId);
  world.transforms.set(houseId, { position: { x, y }, rotation: 0 });
  world.shapes.set(houseId, houseShapeFromLayout(layout));
  world.southDrifts.set(houseId, { vy: 0 });
  world.staticObstacles.set(houseId, { kind: 'house' });
  world.houses.set(houseId, houseComponentFromLayout('Pentagon', layout, null));
  world.houseOccupants.set(houseId, new Set());
  return houseId;
}

function hasPair(world: ReturnType<typeof createWorld>, a: number, b: number): boolean {
  return world.collisions.some(
    (pair) => (pair.a === a && pair.b === b) || (pair.a === b && pair.b === a),
  );
}

describe('housing exit clearance', () => {
  it('pushes entity out of doorway, suppresses transit collision temporarily, then re-enables pair collisions', () => {
    const world = createWorld(7201, {
      housesEnabled: true,
      topology: 'bounded',
      width: 900,
      height: 600,
    });
    world.config.rainEnabled = true;

    const movementSystem = new MovementSystem();
    const collisionSystem = new CollisionSystem();
    const houseSystem = new HouseSystem();
    const resolutionSystem = new CollisionResolutionSystem();
    const dt = 1 / world.config.tickRate;

    const houseId = addHouse(world, 420, 280);
    const personId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: 420, y: 280 },
    );

    const dwelling = world.dwellings.get(personId);
    const house = world.houses.get(houseId);
    const houseTransform = world.transforms.get(houseId);
    const personTransform = world.transforms.get(personId);
    if (!dwelling || !house || !houseTransform || !personTransform) {
      throw new Error('Failed to initialize housing exit clearance test state.');
    }

    dwelling.state = 'inside';
    dwelling.houseId = houseId;
    dwelling.ticksInside = 120;
    dwelling.cooldownTicks = 0;
    world.houseOccupants.get(houseId)?.add(personId);

    houseSystem.update(world);
    expect(dwelling.state).toBe('outside');
    expect(dwelling.transit?.phase).toBe('exiting');
    expect(dwelling.ignoreHouseCollisionHouseId).toBe(houseId);
    expect(dwelling.ignoreHouseCollisionTicks).toBeGreaterThan(0);

    const houseGeometry = geometryFromComponents(world.shapes.get(houseId)!, houseTransform);
    if (houseGeometry.kind !== 'polygon') {
      throw new Error('Expected polygonal house geometry.');
    }

    const distances: number[] = [];
    const sampleTicks = 8;
    for (let i = 0; i < sampleTicks; i += 1) {
      movementSystem.update(world, dt);
      collisionSystem.update(world, dt);
      houseSystem.update(world);
      resolutionSystem.update(world, dt);
      distances.push(distancePointToPolygonBoundary(personTransform.position, houseGeometry));
    }

    const firstDistance = distances[0] ?? 0;
    const lastDistance = distances[distances.length - 1] ?? 0;
    expect(lastDistance).toBeGreaterThan(firstDistance + 2);
    for (let i = 1; i < distances.length; i += 1) {
      const current = distances[i] ?? 0;
      const previous = distances[i - 1] ?? 0;
      expect(current).toBeGreaterThanOrEqual(previous - 1e-6);
    }

    const ignoreTicksAtStart = dwelling.ignoreHouseCollisionTicks;
    expect(ignoreTicksAtStart).toBeGreaterThan(0);

    for (let i = 0; i < ignoreTicksAtStart; i += 1) {
      collisionSystem.update(world, dt);
      expect(hasPair(world, personId, houseId)).toBe(false);
      houseSystem.update(world);
    }

    expect(dwelling.ignoreHouseCollisionTicks).toBe(0);

    const westDoor = doorPoseWorld(houseTransform, house.doorWest);
    personTransform.position = {
      x: westDoor.midpoint.x - westDoor.normalInward.x * 0.2,
      y: westDoor.midpoint.y - westDoor.normalInward.y * 0.2,
    };

    collisionSystem.update(world, dt);
    expect(hasPair(world, personId, houseId)).toBe(true);
  });
});
