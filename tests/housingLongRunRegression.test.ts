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

const LONG_RUN_TICKS = 4_800;

describe('housing long-run regression', () => {
  it(
    'maintains repeatable house usage over long runs without sustained house-contact lockups',
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

      let totalEntries = 0;
      let insideSamples = 0;
      let warmupInsideSeen = false;
      let maxStuckNearHouse = 0;

      for (let tick = 1; tick <= LONG_RUN_TICKS; tick += 1) {
        simulation.stepOneTick();
        totalEntries += world.houseEntriesThisTick;
        insideSamples += world.insideCountThisTick;
        maxStuckNearHouse = Math.max(maxStuckNearHouse, world.stuckNearHouseCount);
        if (tick >= 1000 && world.insideCountThisTick > 0) {
          warmupInsideSeen = true;
        }
      }

      expect(totalEntries).toBeGreaterThan(8);
      expect(insideSamples).toBeGreaterThan(0);
      expect(warmupInsideSeen).toBe(true);
      expect(maxStuckNearHouse).toBeLessThanOrEqual(2);
    },
    120_000,
  );
});
