import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { FeelingApproachSystem } from '../src/systems/feelingApproachSystem';
import { FeelingSystem } from '../src/systems/feelingSystem';
import { HearingSystem } from '../src/systems/hearingSystem';
import { IntroductionIntentSystem } from '../src/systems/introductionIntentSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';
import { SleepSystem } from '../src/systems/sleepSystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../src/systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../src/systems/southAttractionSystem';
import { StillnessControllerSystem } from '../src/systems/stillnessControllerSystem';
import { VisionSystem } from '../src/systems/visionSystem';

describe('handshake integration', () => {
  it('produces deliberate handshakes with felt full stillness and deterministic knowledge updates', () => {
    const world = createWorld(1801, {
      southAttractionEnabled: false,
      topology: 'bounded',
      introductionRadius: 180,
      preContactRadius: 26,
      handshakeStillnessTicks: 10,
      handshakeCooldownTicks: 36,
      feelSpeedThreshold: 12,
      fogDensity: 0.012,
      sightEnabled: true,
    });

    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      {
        type: 'socialNav',
        boundary: 'bounce',
        maxSpeed: 10,
        maxTurnRate: 1.1,
        decisionEveryTicks: 8,
        intentionMinTicks: 26,
      },
      { x: 220, y: 220 },
    );

    const b = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 16, irregular: false },
      {
        type: 'socialNav',
        boundary: 'bounce',
        maxSpeed: 10,
        maxTurnRate: 1.1,
        decisionEveryTicks: 8,
        intentionMinTicks: 26,
      },
      { x: 242, y: 220 },
    );

    const aFeeling = world.feeling.get(a);
    const aMovement = world.movements.get(a);
    if (aFeeling) {
      aFeeling.state = 'approaching';
      aFeeling.partnerId = b;
      aFeeling.ticksLeft = 0;
    }
    if (aMovement && aMovement.type === 'socialNav') {
      aMovement.intention = 'approachForFeeling';
      aMovement.goal = {
        type: 'point',
        targetId: b,
      };
      aMovement.intentionTicksLeft = Math.max(1, aMovement.intentionMinTicks);
    }

    const simulation = new FixedTimestepSimulation(world, [
      new PeaceCrySystem(),
      new HearingSystem(),
      new VisionSystem(),
      new SocialNavMindSystem(),
      new FeelingApproachSystem(),
      new IntroductionIntentSystem(),
      new StillnessControllerSystem(),
      new SouthAttractionSystem(),
      new SleepSystem(),
      new SocialNavSteeringSystem(),
      new AvoidanceSteeringSystem(),
      new MovementSystem(),
      new CollisionSystem(),
      new FeelingSystem(),
    ]);

    let started = 0;
    let completed = 0;
    let feltFullStillnessObserved = false;

    for (let tick = 0; tick < 600; tick += 1) {
      simulation.stepOneTick();
      started += world.handshakeStartedThisTick;
      completed += world.handshakeCompletedThisTick;

      const aFeeling = world.feeling.get(a);
      const bFeeling = world.feeling.get(b);
      if (!aFeeling || !bFeeling) {
        continue;
      }

      const aStillness = world.stillness.get(a);
      const bStillness = world.stillness.get(b);
      const aFeelsB = aFeeling.state === 'feeling' && aFeeling.partnerId === b;
      const bBeingFeltByA = bFeeling.state === 'beingFelt' && bFeeling.partnerId === a;
      const bFeelsA = bFeeling.state === 'feeling' && bFeeling.partnerId === a;
      const aBeingFeltByB = aFeeling.state === 'beingFelt' && aFeeling.partnerId === b;

      if (
        (aFeelsB &&
          bBeingFeltByA &&
          bStillness?.mode === 'full' &&
          bStillness.reason === 'beingFelt' &&
          bStillness.requestedBy === a) ||
        (bFeelsA &&
          aBeingFeltByB &&
          aStillness?.mode === 'full' &&
          aStillness.reason === 'beingFelt' &&
          aStillness.requestedBy === b)
      ) {
        feltFullStillnessObserved = true;
      }

      if (started > 0 && completed > 0 && world.knowledge.get(a)?.known.has(b) && world.knowledge.get(b)?.known.has(a)) {
        break;
      }
    }

    expect(started).toBeGreaterThan(0);
    expect(completed).toBeGreaterThan(0);
    expect(feltFullStillnessObserved).toBe(true);
    expect(world.knowledge.get(a)?.known.has(b)).toBe(true);
    expect(world.knowledge.get(b)?.known.has(a)).toBe(true);
  });
});
