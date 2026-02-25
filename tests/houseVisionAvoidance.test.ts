import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createHouseLayout, houseComponentFromLayout, houseShapeFromLayout } from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';
import { VisionSystem } from '../src/systems/visionSystem';

function addHouse(world: ReturnType<typeof createWorld>, x: number, y: number, size = 56): number {
  const layout = createHouseLayout('Pentagon', size);
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

describe('house visibility and obstacle avoidance', () => {
  it('includes houses in FOV scanning even when house center is slightly outside the view cone', () => {
    const world = createWorld(3101, {
      topology: 'torus',
      southAttractionEnabled: false,
      sightEnabled: true,
      fogDensity: 0.006,
      fogMinIntensity: 0.08,
      fogMaxDistance: 500,
    });

    const viewerId = spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const viewerTransform = world.transforms.get(viewerId);
    const viewerVision = world.vision.get(viewerId);
    const viewerEye = world.eyes.get(viewerId);
    const viewerPerception = world.perceptions.get(viewerId);
    if (!viewerTransform || !viewerVision || !viewerEye || !viewerPerception) {
      throw new Error('Missing viewer state in house-vision FOV test.');
    }
    viewerTransform.rotation = 0;
    viewerVision.range = 260;
    viewerEye.fovRad = Math.PI / 2;
    viewerPerception.sightSkill = 1;

    const houseId = addHouse(world, 175, 195, 62);

    const vision = new VisionSystem();
    vision.update(world);
    const hit = world.visionHits.get(viewerId);
    expect(hit?.hitId).toBe(houseId);
    expect(hit?.kind).toBe('entity');
  });

  it('applies obstacle-aware avoidance distance when the current vision hit is a house', () => {
    const world = createWorld(3102, {
      southAttractionEnabled: false,
    });
    const viewerId = spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      { type: 'randomWalk', speed: 10, turnRate: 1.2, boundary: 'wrap' },
      { x: 300, y: 200 },
    );
    const movement = world.movements.get(viewerId);
    const vision = world.vision.get(viewerId);
    if (!movement || movement.type === 'straightDrift' || !vision) {
      throw new Error('Missing viewer movement/vision in obstacle-avoidance test.');
    }

    vision.enabled = true;
    vision.avoidDistance = 6;
    vision.avoidTurnRate = 2.4;
    movement.heading = 0;

    const houseId = addHouse(world, 360, 220, 72);
    const initialHeading = movement.heading;
    world.visionHits.set(viewerId, {
      hitId: houseId,
      distance: 20,
      distanceReliable: true,
      intensity: 0.85,
      direction: { x: 1, y: 0.45 },
      kind: 'entity',
    });

    const avoidance = new AvoidanceSteeringSystem();
    avoidance.update(world, 1 / world.config.tickRate);
    expect(movement.heading).toBeLessThan(initialHeading);
  });

  it('does not treat houses as social targets for mating/feeling intentions', () => {
    const world = createWorld(3103, {
      southAttractionEnabled: false,
      sightEnabled: true,
    });
    const observerId = spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 12,
        maxTurnRate: 1.2,
        decisionEveryTicks: 5,
        intentionMinTicks: 16,
      },
      { x: 220, y: 180 },
    );
    const movement = world.movements.get(observerId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Missing observer social-nav state in house social-target test.');
    }
    movement.intentionTicksLeft = 0;

    const houseId = addHouse(world, 250, 180, 54);
    world.visionHits.set(observerId, {
      hitId: houseId,
      distance: 12,
      distanceReliable: true,
      intensity: 0.92,
      direction: { x: 1, y: 0 },
      kind: 'entity',
    });

    const mind = new SocialNavMindSystem();
    mind.update(world);

    const next = world.movements.get(observerId);
    const intention = next && next.type === 'socialNav' ? next.intention : null;
    expect(intention).not.toBe('approachForFeeling');
    expect(intention).not.toBe('approachMate');
  });
});
