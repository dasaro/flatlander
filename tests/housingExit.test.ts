import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createHouseLayout, doorPoseWorld, houseComponentFromLayout, houseShapeFromLayout } from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
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

describe('housing exit behavior', () => {
  it('exits after indoor stay and places person outside the preferred door', () => {
    const world = createWorld(21, { housesEnabled: true });
    const houseSystem = new HouseSystem();
    const houseId = addHouse(world, 420, 260);

    const manId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 0, y: 0 },
    );

    const house = world.houses.get(houseId);
    const houseTransform = world.transforms.get(houseId);
    const manTransform = world.transforms.get(manId);
    if (!house || !houseTransform || !manTransform) {
      throw new Error('Failed to initialize house exit test.');
    }

    const westDoor = doorPoseWorld(houseTransform, house.doorWest);
    manTransform.position = {
      x: westDoor.midpoint.x - westDoor.normalInward.x * 0.2,
      y: westDoor.midpoint.y - westDoor.normalInward.y * 0.2,
    };
    world.movements.set(manId, {
      type: 'straightDrift',
      boundary: 'wrap',
      vx: westDoor.normalInward.x * 4,
      vy: westDoor.normalInward.y * 4,
    });
    const durability = world.durability.get(manId);
    if (durability) {
      durability.hp = 1;
    }

    houseSystem.update(world);
    expect(world.dwellings.get(manId)?.state).toBe('inside');
    if (durability) {
      durability.hp = durability.maxHp;
    }

    for (let step = 0; step < 180; step += 1) {
      world.tick += 1;
      houseSystem.update(world);
      if (world.dwellings.get(manId)?.state === 'outside') {
        break;
      }
    }

    const dwelling = world.dwellings.get(manId);
    if (!dwelling) {
      throw new Error('Missing dwelling state.');
    }
    expect(dwelling.state).toBe('outside');
    expect(dwelling.houseId).toBeNull();
    expect((world.houseOccupants.get(houseId)?.has(manId) ?? false)).toBe(false);

    const outsideDistance = Math.hypot(
      manTransform.position.x - westDoor.midpoint.x,
      manTransform.position.y - westDoor.midpoint.y,
    );
    expect(outsideDistance).toBeGreaterThan(2);
    expect(outsideDistance).toBeLessThan(40);
  });
});
