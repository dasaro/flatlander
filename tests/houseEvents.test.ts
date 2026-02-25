import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import {
  createHouseLayout,
  doorPoseWorld,
  houseComponentFromLayout,
  houseShapeFromLayout,
} from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { HouseSystem } from '../src/systems/houseSystem';

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

describe('house transition events', () => {
  it('emits deterministic houseEnter and houseExit events with reason payloads', () => {
    const world = createWorld(8080, {
      housesEnabled: true,
      rainEnabled: true,
    });
    const collisionSystem = new CollisionSystem();
    const houseSystem = new HouseSystem();
    const houseId = addHouse(world, 240, 200);

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
      throw new Error('Missing setup components for house event test.');
    }

    const eastDoor = doorPoseWorld(houseTransform, house.doorEast);
    womanTransform.position = {
      x: eastDoor.midpoint.x - eastDoor.normalInward.x * 0.25,
      y: eastDoor.midpoint.y - eastDoor.normalInward.y * 0.25,
    };

    world.tick = 1;
    world.weather.isRaining = true;
    collisionSystem.update(world, 1 / world.config.tickRate);
    houseSystem.update(world);

    const firstEvents = world.events.drain();
    const enterEvent = firstEvents.find((event) => event.type === 'houseEnter');
    expect(enterEvent).toBeDefined();
    if (!enterEvent || enterEvent.type !== 'houseEnter') {
      throw new Error('Missing houseEnter event.');
    }
    expect(enterEvent.entityId).toBe(womanId);
    expect(enterEvent.houseId).toBe(houseId);
    expect(enterEvent.doorSide).toBe('east');
    expect(enterEvent.reason).toBe('RainShelter');

    const dwelling = world.dwellings.get(womanId);
    if (!dwelling) {
      throw new Error('Missing dwelling after entry.');
    }
    dwelling.ticksInside = 1_000;
    world.tick = 2;
    world.weather.isRaining = false;
    houseSystem.update(world);

    const secondEvents = world.events.drain();
    const exitEvent = secondEvents.find((event) => event.type === 'houseExit');
    expect(exitEvent).toBeDefined();
    if (!exitEvent || exitEvent.type !== 'houseExit') {
      throw new Error('Missing houseExit event.');
    }
    expect(exitEvent.entityId).toBe(womanId);
    expect(exitEvent.houseId).toBe(houseId);
    expect(exitEvent.doorSide).toBe('east');
    expect(exitEvent.reason).toBe('Wander');
  });
});
