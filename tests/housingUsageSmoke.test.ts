import { describe, expect, it } from 'vitest';

import { FixedTimestepSimulation } from '../src/core/simulation';
import { createDefaultWorld } from '../src/presets/defaultScenario';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { HouseSystem } from '../src/systems/houseSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { RainSystem } from '../src/systems/rainSystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../src/systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../src/systems/southAttractionSystem';
import { StillnessControllerSystem } from '../src/systems/stillnessControllerSystem';
import { SwaySystem } from '../src/systems/swaySystem';
import { VisionSystem } from '../src/systems/visionSystem';

describe('housing usage smoke', () => {
  it(
    'shows deterministic house entries/exits in a 10k-tick run (seed 42)',
    () => {
      const world = createDefaultWorld(42);
      const simulation = new FixedTimestepSimulation(world, [
        new RainSystem(),
        new VisionSystem(),
        new SocialNavMindSystem(),
        new StillnessControllerSystem(),
        new SouthAttractionSystem(),
        new SocialNavSteeringSystem(),
        new AvoidanceSteeringSystem(),
        new MovementSystem(),
        new SwaySystem(),
        new CollisionSystem(),
        new HouseSystem(),
        new CollisionResolutionSystem(),
      ]);

      let enterCount = 0;
      let exitTransitions = 0;
      let sawInside = false;
      let previousInside = 0;
      for (let i = 0; i < 10_000; i += 1) {
        simulation.stepOneTick();
        enterCount += world.houseEntriesThisTick;
        sawInside ||= world.insideCountThisTick > 0;
        if (world.insideCountThisTick < previousInside) {
          exitTransitions += previousInside - world.insideCountThisTick;
        }
        previousInside = world.insideCountThisTick;
      }

      expect(sawInside).toBe(true);
      expect(enterCount).toBeGreaterThan(0);
      expect(exitTransitions).toBeGreaterThan(0);
    },
    90_000,
  );
});
