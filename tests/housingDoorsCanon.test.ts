import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createHouseLayout, doorPoseWorld, houseComponentFromLayout, houseShapeFromLayout } from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { HouseSystem } from '../src/systems/houseSystem';

function addHouse(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const layout = createHouseLayout('Pentagon', 30);
  const id = world.nextEntityId;
  world.nextEntityId += 1;
  world.entities.add(id);
  world.transforms.set(id, { position: { x, y }, rotation: 0 });
  world.shapes.set(id, houseShapeFromLayout(layout));
  world.staticObstacles.set(id, { kind: 'house' });
  world.southDrifts.set(id, { vy: 0 });
  world.houses.set(id, houseComponentFromLayout('Pentagon', layout, null));
  world.houseOccupants.set(id, new Set());
  return id;
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
  const durability = world.durability.get(personId);
  if (!house || !houseTransform || !transform || !durability) {
    throw new Error('Door attempt setup failed.');
  }

  const door = side === 'east' ? house.doorEast : house.doorWest;
  const pose = doorPoseWorld(houseTransform, door);
  transform.position = {
    x: pose.midpoint.x - pose.normalInward.x * 0.2,
    y: pose.midpoint.y - pose.normalInward.y * 0.2,
  };
  transform.rotation = Math.atan2(pose.normalInward.y, pose.normalInward.x);
  durability.hp = 1;
}

describe('canon housing doors', () => {
  it('segments enter through the east door and polygons through the west door, emitting door-side events', () => {
    const collisionSystem = new CollisionSystem();
    const houseSystem = new HouseSystem();

    const womanWorld = createWorld(1, { housesEnabled: true });
    womanWorld.weather.isRaining = true;
    const womanHouseId = addHouse(womanWorld, 300, 220);
    const womanId = spawnEntity(
      womanWorld,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    placeNearDoorForAttempt(womanWorld, womanId, womanHouseId, 'east');
    collisionSystem.update(womanWorld, 1 / womanWorld.config.tickRate);
    houseSystem.update(womanWorld);
    const womanEvents = womanWorld.events.drain();
    const womanEnter = womanEvents.find((event) => event.type === 'houseEnter');
    expect(womanEnter).toBeDefined();
    if (!womanEnter || womanEnter.type !== 'houseEnter') {
      throw new Error('Expected woman houseEnter event.');
    }
    expect(womanEnter.entityId).toBe(womanId);
    expect(womanEnter.houseId).toBe(womanHouseId);
    expect(womanEnter.doorSide).toBe('east');

    const manWorld = createWorld(2, { housesEnabled: true });
    manWorld.weather.isRaining = true;
    const manHouseId = addHouse(manWorld, 300, 220);
    const manId = spawnEntity(
      manWorld,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    placeNearDoorForAttempt(manWorld, manId, manHouseId, 'west');
    collisionSystem.update(manWorld, 1 / manWorld.config.tickRate);
    houseSystem.update(manWorld);
    const manEvents = manWorld.events.drain();
    const manEnter = manEvents.find((event) => event.type === 'houseEnter');
    expect(manEnter).toBeDefined();
    if (!manEnter || manEnter.type !== 'houseEnter') {
      throw new Error('Expected polygon houseEnter event.');
    }
    expect(manEnter.entityId).toBe(manId);
    expect(manEnter.houseId).toBe(manHouseId);
    expect(manEnter.doorSide).toBe('west');
  });

  it('emits matching canonical door-side events on exit', () => {
    const houseSystem = new HouseSystem();
    const world = createWorld(3, { housesEnabled: true });
    const westHouseId = addHouse(world, 320, 240);
    const manId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 320, y: 240 },
    );
    const dwelling = world.dwellings.get(manId);
    if (!dwelling) {
      throw new Error('Expected dwelling state for exit test.');
    }
    dwelling.state = 'inside';
    dwelling.houseId = westHouseId;
    dwelling.ticksInside = 280;
    world.houseOccupants.get(westHouseId)?.add(manId);
    houseSystem.update(world);
    const westExit = world.events.drain().find((event) => event.type === 'houseExit');
    expect(westExit).toBeDefined();
    if (!westExit || westExit.type !== 'houseExit') {
      throw new Error('Expected polygon houseExit event.');
    }
    expect(westExit.doorSide).toBe('west');

    const eastHouseId = addHouse(world, 450, 240);
    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 450, y: 240 },
    );
    const womanDwelling = world.dwellings.get(womanId);
    if (!womanDwelling) {
      throw new Error('Expected woman dwelling state for exit test.');
    }
    womanDwelling.state = 'inside';
    womanDwelling.houseId = eastHouseId;
    womanDwelling.ticksInside = 280;
    world.houseOccupants.get(eastHouseId)?.add(womanId);
    houseSystem.update(world);
    const eastExit = world.events.drain().find((event) => event.type === 'houseExit');
    expect(eastExit).toBeDefined();
    if (!eastExit || eastExit.type !== 'houseExit') {
      throw new Error('Expected segment houseExit event.');
    }
    expect(eastExit.doorSide).toBe('east');
  });
});
