import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { HearingSystem } from '../src/systems/hearingSystem';
import { VisionSystem } from '../src/systems/visionSystem';

describe('hearing and isosceles imposture', () => {
  it('produces hearing hits inside radius and none when outside radius', () => {
    const world = createWorld(90);
    const listenerId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    const targetId = spawnEntity(
      world,
      { kind: 'circle', size: 12 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 160, y: 100 },
    );

    const perception = world.perceptions.get(listenerId);
    if (!perception) {
      throw new Error('Missing listener perception in hearing test.');
    }
    perception.hearingRadius = 100;
    perception.hearingSkill = 0.8;

    const hearing = new HearingSystem();
    hearing.update(world, 1 / world.config.tickRate);
    expect(world.hearingHits.get(listenerId)?.otherId).toBe(targetId);

    const targetTransform = world.transforms.get(targetId);
    if (!targetTransform) {
      throw new Error('Missing target transform in hearing range test.');
    }
    targetTransform.position = { x: 260, y: 100 };
    hearing.update(world, 1 / world.config.tickRate);
    expect(world.hearingHits.has(listenerId)).toBe(false);
  });

  it('uses isosceles mimicry signature when enabled', () => {
    const world = createWorld(91);
    const listenerId = spawnEntity(
      world,
      { kind: 'polygon', sides: 6, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 100 },
    );
    const isoscelesId = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 18,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.06,
      },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 170, y: 100 },
    );

    const voice = world.voices.get(isoscelesId);
    const perception = world.perceptions.get(listenerId);
    if (!voice || !perception) {
      throw new Error('Missing voice/perception component in mimicry test.');
    }
    voice.mimicryEnabled = true;
    voice.mimicrySignature = 'HighOrder';
    perception.hearingRadius = 120;

    const hearing = new HearingSystem();
    hearing.update(world, 1 / world.config.tickRate);
    expect(world.hearingHits.get(listenerId)?.signature).toBe('HighOrder');
  });

  it('steers from hearing when sight is unavailable', () => {
    const world = createWorld(92, {
      sightEnabled: true,
      fogDensity: 0,
    });

    const moverId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'randomWalk', speed: 18, turnRate: 1.2, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    spawnEntity(
      world,
      { kind: 'circle', size: 12 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 140 },
    );

    const mover = world.movements.get(moverId);
    const perception = world.perceptions.get(moverId);
    const vision = world.vision.get(moverId);
    if (!mover || mover.type === 'straightDrift' || !perception || !vision) {
      throw new Error('Mover setup failed in hearing steering test.');
    }

    mover.heading = 0;
    perception.hearingRadius = 120;
    perception.hearingSkill = 0.8;
    vision.enabled = true;
    vision.avoidTurnRate = 2;
    vision.avoidDistance = 80;

    const dt = 1 / world.config.tickRate;
    const hearing = new HearingSystem();
    const visionSystem = new VisionSystem();
    const avoidance = new AvoidanceSteeringSystem();
    hearing.update(world, dt);
    visionSystem.update(world);
    const before = mover.heading;
    avoidance.update(world, dt);

    const after = world.movements.get(moverId);
    if (!after || after.type === 'straightDrift') {
      throw new Error('Mover missing after hearing steering update.');
    }
    expect(after.heading).toBeLessThan(before);
  });
});
