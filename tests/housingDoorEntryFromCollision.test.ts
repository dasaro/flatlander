import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import {
  createHouseLayout,
  doorPoseWorld,
  houseComponentFromLayout,
  houseShapeFromLayout,
} from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
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

function placeForDoorContact(
  world: ReturnType<typeof createWorld>,
  personId: number,
  houseId: number,
  side: 'east' | 'west',
): void {
  const house = world.houses.get(houseId);
  const houseTransform = world.transforms.get(houseId);
  const personTransform = world.transforms.get(personId);
  if (!house || !houseTransform || !personTransform) {
    throw new Error('Missing setup components for door placement.');
  }

  const doorSpec = side === 'east' ? house.doorEast : house.doorWest;
  const pose = doorPoseWorld(houseTransform, doorSpec);
  personTransform.position = {
    x: pose.midpoint.x - pose.normalInward.x * 0.25,
    y: pose.midpoint.y - pose.normalInward.y * 0.25,
  };
}

describe('house entry from collision contact points', () => {
  it('enters through the gendered door only and records contact/entry counters', () => {
    const world = createWorld(3301, {
      housesEnabled: true,
      rainEnabled: true,
    });
    world.weather.isRaining = true;

    const collisionSystem = new CollisionSystem();
    const houseSystem = new HouseSystem();
    const resolutionSystem = new CollisionResolutionSystem();
    const houseId = addHouse(world, 260, 210);

    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    const manId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    const womanWrongDoorId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    const manWrongDoorId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );

    placeForDoorContact(world, womanId, houseId, 'east');
    placeForDoorContact(world, manId, houseId, 'west');
    placeForDoorContact(world, womanWrongDoorId, houseId, 'west');
    placeForDoorContact(world, manWrongDoorId, houseId, 'east');

    collisionSystem.update(world, 1 / world.config.tickRate);
    houseSystem.update(world);
    resolutionSystem.update(world, 1 / world.config.tickRate);

    expect(world.houseDoorContactsThisTick).toBeGreaterThanOrEqual(2);
    expect(world.houseEntriesThisTick).toBe(2);
    expect(world.dwellings.get(womanId)?.state).toBe('inside');
    expect(world.dwellings.get(manId)?.state).toBe('inside');
    expect(world.dwellings.get(womanWrongDoorId)?.state).toBe('outside');
    expect(world.dwellings.get(manWrongDoorId)?.state).toBe('outside');
  });

  it('does not enter on incidental dry contact without shelter/home/healing motivation', () => {
    const world = createWorld(3302, {
      housesEnabled: true,
      rainEnabled: true,
    });
    world.weather.isRaining = false;

    const collisionSystem = new CollisionSystem();
    const houseSystem = new HouseSystem();
    const resolutionSystem = new CollisionResolutionSystem();
    const houseId = addHouse(world, 260, 210);

    const manId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );
    placeForDoorContact(world, manId, houseId, 'west');

    const durability = world.durability.get(manId);
    if (!durability) {
      throw new Error('Missing durability in incidental entry test.');
    }
    durability.hp = durability.maxHp;

    collisionSystem.update(world, 1 / world.config.tickRate);
    houseSystem.update(world);
    resolutionSystem.update(world, 1 / world.config.tickRate);

    expect(world.houseDoorContactsThisTick).toBeGreaterThan(0);
    expect(world.houseEntriesThisTick).toBe(0);
    expect(world.dwellings.get(manId)?.state).toBe('outside');
  });
});
