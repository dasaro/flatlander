import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import {
  createHouseLayout,
  doorPoseWorld,
  houseComponentFromLayout,
  houseShapeFromLayout,
} from '../src/core/housing/houseFactory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { HouseSystem } from '../src/systems/houseSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { SocialNavSteeringSystem } from '../src/systems/socialNavSteeringSystem';

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

describe('housing wall-follow approach', () => {
  it('slides along wall toward the target door and enters within bounded ticks', () => {
    const world = createWorld(7101, {
      housesEnabled: true,
      rainEnabled: true,
      southAttractionEnabled: false,
    });
    world.weather.isRaining = true;

    const houseId = addHouse(world, 300, 220);
    const house = world.houses.get(houseId);
    const houseTransform = world.transforms.get(houseId);
    if (!house || !houseTransform) {
      throw new Error('Expected house setup for wall-follow test.');
    }

    const westDoor = doorPoseWorld(houseTransform, house.doorWest);
    const manId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 10,
        maxTurnRate: 1.3,
        decisionEveryTicks: 12,
        intentionMinTicks: 60,
      },
      {
        x: westDoor.midpoint.x - westDoor.normalInward.x * 2.5,
        y: westDoor.midpoint.y + 18,
      },
    );

    const movement = world.movements.get(manId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Expected socialNav movement for wall-follow test.');
    }
    movement.intention = 'seekShelter';
    movement.goal = {
      type: 'point',
      targetId: houseId,
      x: westDoor.midpoint.x,
      y: westDoor.midpoint.y,
      doorSide: 'west',
    };
    movement.intentionTicksLeft = 200;

    const simulation = new FixedTimestepSimulation(world, [
      new SocialNavSteeringSystem(),
      new MovementSystem(),
      new CollisionSystem(),
      new HouseSystem(),
      new CollisionResolutionSystem(),
    ]);

    for (let i = 0; i < 260; i += 1) {
      simulation.stepOneTick();
      if (world.dwellings.get(manId)?.state === 'inside') {
        break;
      }
    }

    expect(world.dwellings.get(manId)?.state).toBe('inside');
  });
});
