import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { FeelingSystem } from '../src/systems/feelingSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { StillnessSystem } from '../src/systems/stillnessSystem';

describe('handshake canon behavior', () => {
  it('requires the felt to stand fully still and updates knowledge reciprocally on success', () => {
    const world = createWorld(71, {
      handshakeStillnessTicks: 6,
      handshakePreStillnessTicks: 2,
      feelSpeedThreshold: 6,
      southAttractionEnabled: false,
    });

    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'straightDrift', vx: 0.4, vy: 0, boundary: 'wrap' },
      { x: 210, y: 210 },
    );
    const b = spawnEntity(
      world,
      { kind: 'circle', size: 16 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 210, y: 210 },
    );

    const aFeeling = world.feeling.get(a);
    const bFeeling = world.feeling.get(b);
    if (!aFeeling || !bFeeling) {
      throw new Error('Missing feeling state in handshake canon test.');
    }
    aFeeling.state = 'approaching';
    aFeeling.partnerId = b;
    bFeeling.state = 'approaching';
    bFeeling.partnerId = a;

    const collision = new CollisionSystem();
    const feeling = new FeelingSystem();
    const stillness = new StillnessSystem();
    const movement = new MovementSystem();
    const dt = 1 / world.config.tickRate;

    world.tick = 1;
    collision.update(world, dt);
    feeling.update(world, dt);
    stillness.update(world);

    const activeA = world.stillness.get(a);
    const activeB = world.stillness.get(b);
    expect(activeA?.mode === 'translation' || activeB?.mode === 'translation').toBe(true);
    expect(activeA?.mode === 'full' || activeB?.mode === 'full').toBe(true);

    const startA = { ...world.transforms.get(a)!.position };
    const startB = { ...world.transforms.get(b)!.position };

    for (let i = 0; i < 4; i += 1) {
      world.tick += 1;
      stillness.update(world);
      movement.update(world, dt);
      collision.update(world, dt);
      feeling.update(world, dt);
    }

    expect(world.transforms.get(a)?.position.x).toBeCloseTo(startA.x, 5);
    expect(world.transforms.get(b)?.position.x).toBeCloseTo(startB.x, 5);

    const events = world.events.drain();
    const success = events.find((event) => event.type === 'handshake');
    expect(success).toBeDefined();
    expect(world.knowledge.get(a)?.known.has(b)).toBe(true);
    expect(world.knowledge.get(b)?.known.has(a)).toBe(true);
  });

  it('records unsuccessful handshakes without transferring knowledge when stillness is not satisfied', () => {
    const world = createWorld(530, {
      southAttractionEnabled: false,
    });
    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const b = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 14, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 220, y: 220 },
    );
    const aFeeling = world.feeling.get(a);
    const bFeeling = world.feeling.get(b);
    if (!aFeeling || !bFeeling) {
      throw new Error('Missing feeling state in failed handshake test.');
    }
    aFeeling.state = 'feeling';
    aFeeling.partnerId = b;
    aFeeling.ticksLeft = 1;
    bFeeling.state = 'beingFelt';
    bFeeling.partnerId = a;
    bFeeling.ticksLeft = 1;

    new CollisionSystem().update(world);
    new FeelingSystem().update(world, 1 / world.config.tickRate);

    const failure = world.events.drain().find((event) => event.type === 'handshakeAttemptFailed');
    expect(failure).toBeDefined();
    if (!failure || failure.type !== 'handshakeAttemptFailed') {
      throw new Error('Expected unsuccessful handshake event.');
    }
    expect(failure.reason).toBe('StillnessNotSatisfied');
    expect(world.knowledge.get(a)?.known.has(b)).toBe(false);
    expect(world.knowledge.get(b)?.known.has(a)).toBe(false);
  });
});
