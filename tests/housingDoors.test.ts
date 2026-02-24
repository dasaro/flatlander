import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createHouseLayout, doorPoseWorld, houseComponentFromLayout, houseShapeFromLayout } from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { HouseSystem } from '../src/systems/houseSystem';

function addHouse(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const layout = createHouseLayout('Pentagon', 30);
  const shape = houseShapeFromLayout(layout);
  const houseId = world.nextEntityId;
  world.nextEntityId += 1;
  world.entities.add(houseId);
  world.transforms.set(houseId, {
    position: { x, y },
    rotation: 0,
  });
  world.shapes.set(houseId, shape);
  world.southDrifts.set(houseId, { vy: 0 });
  world.staticObstacles.set(houseId, { kind: 'house' });
  world.houses.set(houseId, houseComponentFromLayout('Pentagon', layout, null));
  world.houseOccupants.set(houseId, new Set());
  return houseId;
}

function placeNearDoorForAttempt(
  world: ReturnType<typeof createWorld>,
  personId: number,
  houseId: number,
  side: 'east' | 'west',
): void {
  const house = world.houses.get(houseId);
  const houseTransform = world.transforms.get(houseId);
  const transform = world.transforms.get(personId);
  const movement = world.movements.get(personId);
  const durability = world.durability.get(personId);
  if (!house || !houseTransform || !transform || !movement || !durability) {
    throw new Error('Failed to set up door approach test.');
  }

  const door = side === 'east' ? house.doorEast : house.doorWest;
  const pose = doorPoseWorld(houseTransform, door);
  transform.position = {
    x: pose.midpoint.x - pose.normalInward.x * 0.2,
    y: pose.midpoint.y - pose.normalInward.y * 0.2,
  };
  transform.rotation = Math.atan2(pose.normalInward.y, pose.normalInward.x);
  durability.hp = 1;

  world.movements.set(personId, {
    type: 'straightDrift',
    boundary: 'wrap',
    vx: pose.normalInward.x * 4,
    vy: pose.normalInward.y * 4,
  });
}

describe('housing door rules', () => {
  it('women enter from east door but not west door', () => {
    const houseSystem = new HouseSystem();
    const collisionSystem = new CollisionSystem();

    const eastWorld = createWorld(1, { housesEnabled: true });
    eastWorld.config.rainEnabled = true;
    eastWorld.weather.isRaining = true;
    const eastHouseId = addHouse(eastWorld, 300, 220);
    const womanEastId = spawnEntity(
      eastWorld,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    placeNearDoorForAttempt(eastWorld, womanEastId, eastHouseId, 'east');
    collisionSystem.update(eastWorld, 1 / eastWorld.config.tickRate);
    houseSystem.update(eastWorld);
    expect(eastWorld.dwellings.get(womanEastId)?.state).toBe('inside');
    expect(eastWorld.dwellings.get(womanEastId)?.houseId).toBe(eastHouseId);

    const westWorld = createWorld(2, { housesEnabled: true });
    westWorld.config.rainEnabled = true;
    westWorld.weather.isRaining = true;
    const westHouseId = addHouse(westWorld, 300, 220);
    const womanWestId = spawnEntity(
      westWorld,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    placeNearDoorForAttempt(westWorld, womanWestId, westHouseId, 'west');
    collisionSystem.update(westWorld, 1 / westWorld.config.tickRate);
    houseSystem.update(westWorld);
    expect(westWorld.dwellings.get(womanWestId)?.state).toBe('outside');
  });

  it('men enter from west door but not east door', () => {
    const houseSystem = new HouseSystem();
    const collisionSystem = new CollisionSystem();

    const westWorld = createWorld(3, { housesEnabled: true });
    westWorld.config.rainEnabled = true;
    westWorld.weather.isRaining = true;
    const westHouseId = addHouse(westWorld, 300, 220);
    const manWestId = spawnEntity(
      westWorld,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    placeNearDoorForAttempt(westWorld, manWestId, westHouseId, 'west');
    collisionSystem.update(westWorld, 1 / westWorld.config.tickRate);
    houseSystem.update(westWorld);
    expect(westWorld.dwellings.get(manWestId)?.state).toBe('inside');
    expect(westWorld.dwellings.get(manWestId)?.houseId).toBe(westHouseId);

    const eastWorld = createWorld(4, { housesEnabled: true });
    eastWorld.config.rainEnabled = true;
    eastWorld.weather.isRaining = true;
    const eastHouseId = addHouse(eastWorld, 300, 220);
    const manEastId = spawnEntity(
      eastWorld,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    placeNearDoorForAttempt(eastWorld, manEastId, eastHouseId, 'east');
    collisionSystem.update(eastWorld, 1 / eastWorld.config.tickRate);
    houseSystem.update(eastWorld);
    expect(eastWorld.dwellings.get(manEastId)?.state).toBe('outside');
  });
});
