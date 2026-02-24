import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { FeelingApproachSystem } from '../src/systems/feelingApproachSystem';
import { MovementSystem } from '../src/systems/movementSystem';

describe('approach stability', () => {
  it('suppresses random-walk heading noise while deliberately approaching', () => {
    const world = createWorld(991, {
      southAttractionEnabled: false,
      topology: 'bounded',
      feelingEnabledGlobal: true,
      introductionRadius: 180,
    });

    const subject = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'randomWalk', speed: 10, turnRate: 1.4, boundary: 'bounce' },
      { x: 200, y: 200 },
    );
    const partner = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 14, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: 230, y: 200 },
    );

    const feeling = world.feeling.get(subject);
    if (!feeling) {
      throw new Error('Missing feeling component for subject.');
    }
    feeling.state = 'approaching';
    feeling.partnerId = partner;
    feeling.ticksLeft = 0;

    const movement = world.movements.get(subject);
    if (!movement || movement.type !== 'randomWalk') {
      throw new Error('Missing random-walk movement for subject.');
    }
    movement.heading = 0.5;
    const startHeading = movement.heading;

    const simulation = new FixedTimestepSimulation(world, [new MovementSystem()]);
    for (let i = 0; i < 15; i += 1) {
      simulation.stepOneTick();
    }

    const after = world.movements.get(subject);
    if (!after || after.type !== 'randomWalk') {
      throw new Error('Missing movement after simulation.');
    }
    expect(after.heading).toBeCloseTo(startHeading, 10);
  });

  it('keeps existing approaching partner lock unless target is lost beyond hysteresis', () => {
    const world = createWorld(992, {
      southAttractionEnabled: false,
      topology: 'bounded',
      feelingEnabledGlobal: true,
      introductionRadius: 100,
    });

    const subject = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'randomWalk', speed: 10, turnRate: 1.4, boundary: 'bounce' },
      { x: 300, y: 300 },
    );
    const lockedPartner = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 14, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: 355, y: 300 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 3, size: 14, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: 340, y: 300 },
    );

    const feeling = world.feeling.get(subject);
    if (!feeling) {
      throw new Error('Missing feeling component for subject.');
    }
    feeling.state = 'approaching';
    feeling.partnerId = lockedPartner;
    feeling.ticksLeft = 0;

    new FeelingApproachSystem().update(world, 1 / 30);

    const after = world.feeling.get(subject);
    expect(after?.state).toBe('approaching');
    expect(after?.partnerId).toBe(lockedPartner);
  });

  it('ignores hearing-only steering while in deliberate approach', () => {
    const world = createWorld(993, {
      southAttractionEnabled: false,
      topology: 'bounded',
      feelingEnabledGlobal: true,
      defaultVisionAvoidTurnRate: 2.5,
    });

    const subject = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'randomWalk', speed: 10, turnRate: 1.4, boundary: 'bounce' },
      { x: 450, y: 260 },
    );
    const partner = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 14, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: 490, y: 260 },
    );

    const feeling = world.feeling.get(subject);
    const movement = world.movements.get(subject);
    if (!feeling || !movement || movement.type !== 'randomWalk') {
      throw new Error('Missing approach components.');
    }
    feeling.state = 'approaching';
    feeling.partnerId = partner;
    movement.heading = 0;

    world.hearingHits.set(subject, {
      otherId: partner,
      signature: 'WomanCry',
      distance: 20,
      direction: { x: 0, y: 1 },
    });

    new AvoidanceSteeringSystem().update(world, 1 / 30);

    const after = world.movements.get(subject);
    if (!after || after.type !== 'randomWalk') {
      throw new Error('Missing movement after hearing steering.');
    }
    expect(after.heading).toBeCloseTo(0, 10);
  });
});
