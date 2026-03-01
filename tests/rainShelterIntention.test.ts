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

  it('does not switch to avoid when the current hazard hit is the same target house door', () => {
    const world = createWorld(4402, {
      housesEnabled: true,
      rainEnabled: true,
      sightEnabled: true,
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
      { x: 286, y: 240 },
    );

    const movement = world.movements.get(womanId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Expected socialNav movement in shelter-target hazard test.');
    }
    movement.intention = 'seekShelter';
    movement.intentionTicksLeft = 8;
    movement.goal = {
      type: 'point',
      targetId: houseId,
      doorSide: 'east',
      x: 300,
      y: 240,
    };

    world.visionHits.set(womanId, {
      hitId: houseId,
      distance: 9,
      distanceReliable: true,
      intensity: 0.92,
      direction: { x: 1, y: 0 },
      kind: 'entity',
    });

    new SocialNavMindSystem().update(world);

    const next = world.movements.get(womanId);
    if (!next || next.type !== 'socialNav') {
      throw new Error('Expected socialNav movement after mind update in shelter-target hazard test.');
    }

    expect(next.intention).toBe('seekShelter');
    expect(next.intentionTicksLeft).toBe(7);
  });

  it('can choose seekShelter in dry weather under deterministic crowd pressure', () => {
    const world = createWorld(4403, {
      housesEnabled: true,
      rainEnabled: false,
      crowdStressEnabled: true,
      crowdComfortPopulation: 2,
      sightEnabled: false,
    });
    world.weather.isRaining = false;

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
      { x: 292, y: 240 },
    );
    spawnEntity(
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
      { x: 294, y: 244 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 12,
        maxTurnRate: 1,
        decisionEveryTicks: 4,
        intentionMinTicks: 12,
      },
      { x: 288, y: 236 },
    );

    const movement = world.movements.get(womanId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Expected socialNav movement in dry crowd shelter test.');
    }
    movement.intention = 'roam';
    movement.intentionTicksLeft = 0;

    new SocialNavMindSystem().update(world);

    const next = world.movements.get(womanId);
    if (!next || next.type !== 'socialNav') {
      throw new Error('Expected socialNav movement after dry crowd shelter update.');
    }

    expect(next.intention).toBe('seekShelter');
    expect(next.goal?.type).toBe('point');
    expect(next.goal?.targetId).toBe(houseId);
  });
});
