import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import {
  createHouseLayout,
  houseComponentFromLayout,
  houseShapeFromLayout,
} from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { CivicOrderSystem } from '../src/systems/civicOrderSystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';
import { VisionSystem } from '../src/systems/visionSystem';

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

describe('civic order rain curfew', () => {
  it('keeps a segment seeking shelter instead of forcing a halt when town bearings exist', () => {
    const world = createWorld(5501, {
      housesEnabled: true,
      rainEnabled: true,
      rainCurfewEnabled: true,
      rainCurfewOutsideGraceTicks: 5,
      sightEnabled: true,
    });
    world.weather.isRaining = true;

    addHouse(world, 300, 240);
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
      throw new Error('Expected socialNav movement in civic-order shelter guidance test.');
    }
    movement.intention = 'roam';
    movement.intentionTicksLeft = 0;
    movement.heading = Math.PI;
    movement.smoothHeading = Math.PI;
    const transform = world.transforms.get(womanId);
    if (transform) {
      transform.rotation = Math.PI;
    }

    const vision = new VisionSystem();
    const mind = new SocialNavMindSystem();
    const civic = new CivicOrderSystem();
    for (let tick = 0; tick < 8; tick += 1) {
      world.tick = tick;
      vision.update(world);
      mind.update(world);
      civic.update(world);
    }

    const next = world.movements.get(womanId);
    if (!next || next.type !== 'socialNav') {
      throw new Error('Expected socialNav movement after civic-order shelter guidance test.');
    }

    expect(next.intention).toBe('seekShelter');
    expect(next.goal?.type).toBe('point');
    expect(world.stillnessRequests).toHaveLength(0);
    expect(world.rainCurfewOutsideTicks.has(womanId)).toBe(false);
  });

  it('falls back to wait-for-bearing halts only when no town guidance exists', () => {
    const world = createWorld(5502, {
      housesEnabled: false,
      rainEnabled: true,
      rainCurfewEnabled: true,
      rainCurfewOutsideGraceTicks: 4,
      rainCurfewStillnessTicks: 3,
      sightEnabled: true,
    });
    world.weather.isRaining = true;

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

    const civic = new CivicOrderSystem();
    for (let tick = 0; tick < 6; tick += 1) {
      world.tick = tick;
      civic.update(world);
    }

    const movement = world.movements.get(womanId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Expected socialNav movement after civic-order desolate fallback test.');
    }

    expect(movement.intention).toBe('holdStill');
    expect(world.stillnessRequests.length).toBeGreaterThan(0);
    expect(world.rainCurfewOutsideTicks.get(womanId)).toBeGreaterThanOrEqual(4);
  });
});
