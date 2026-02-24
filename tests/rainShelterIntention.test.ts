import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import {
  createHouseLayout,
  houseComponentFromLayout,
  houseShapeFromLayout,
} from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';

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

describe('rain shelter intention', () => {
  it('chooses seekShelter with a door target when raining', () => {
    const world = createWorld(4401, {
      housesEnabled: true,
      rainEnabled: true,
      sightEnabled: false,
    });
    world.weather.isRaining = true;

    const houseId = addHouse(world, 300, 240);
    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 12,
        maxTurnRate: 1,
        decisionEveryTicks: 4,
        intentionMinTicks: 12,
      },
      { x: 280, y: 240 },
    );

    const movement = world.movements.get(womanId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Expected socialNav movement in shelter intention test.');
    }
    movement.intentionTicksLeft = 0;

    new SocialNavMindSystem().update(world);

    const next = world.movements.get(womanId);
    if (!next || next.type !== 'socialNav') {
      throw new Error('Expected socialNav movement after mind update.');
    }

    expect(next.intention).toBe('seekShelter');
    expect(next.goal?.type).toBe('point');
    expect(next.goal?.targetId).toBe(houseId);
    expect(next.goal?.doorSide).toBe('east');
    expect(typeof next.goal?.x).toBe('number');
    expect(typeof next.goal?.y).toBe('number');
  });
});
