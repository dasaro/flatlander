import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createHouseLayout, doorPoseWorld, houseComponentFromLayout, houseShapeFromLayout } from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { HouseSystem } from '../src/systems/houseSystem';
import { MovementSystem } from '../src/systems/movementSystem';

function addHouse(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const layout = createHouseLayout('Pentagon', 30);
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

describe('indoors exclusion', () => {
  it('skips indoors entities in movement and collision systems', () => {
    const world = createWorld(11, { housesEnabled: true });
    world.config.rainEnabled = true;
    world.weather.isRaining = true;
    const houseSystem = new HouseSystem();
    const movementSystem = new MovementSystem();
    const collisionSystem = new CollisionSystem();
    const houseId = addHouse(world, 320, 240);

    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    const house = world.houses.get(houseId);
    const houseTransform = world.transforms.get(houseId);
    const womanTransform = world.transforms.get(womanId);
    if (!house || !houseTransform || !womanTransform) {
      throw new Error('Failed to create test setup.');
    }

    const eastDoor = doorPoseWorld(houseTransform, house.doorEast);
    womanTransform.position = {
      x: eastDoor.midpoint.x - eastDoor.normalInward.x * 0.2,
      y: eastDoor.midpoint.y - eastDoor.normalInward.y * 0.2,
    };
    world.movements.set(womanId, {
      type: 'straightDrift',
      boundary: 'wrap',
      vx: eastDoor.normalInward.x * 4,
      vy: eastDoor.normalInward.y * 4,
    });
    const durability = world.durability.get(womanId);
    if (durability) {
      durability.hp = 1;
    }

    collisionSystem.update(world, 1 / world.config.tickRate);
    houseSystem.update(world);
    expect(world.dwellings.get(womanId)?.state).toBe('inside');
    const insidePosition = { ...womanTransform.position };

    const outsideId = spawnEntity(
      world,
      { kind: 'circle', size: 16 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      insidePosition,
    );
    expect(outsideId).toBeGreaterThan(0);

    movementSystem.update(world, 1 / world.config.tickRate);
    expect(womanTransform.position.x).toBeCloseTo(insidePosition.x, 6);
    expect(womanTransform.position.y).toBeCloseTo(insidePosition.y, 6);

    collisionSystem.update(world, 1 / world.config.tickRate);
    const touchesInside = world.collisions.some((pair) => pair.a === womanId || pair.b === womanId);
    expect(touchesInside).toBe(false);
  });
});
