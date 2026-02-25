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
    async () => {
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
      let exitCount = 0;
      let sawInside = false;
      for (let i = 0; i < 10_000; i += 1) {
        simulation.stepOneTick();
        sawInside ||= world.insideCountThisTick > 0;
        const events = world.events.drain();
        for (const event of events) {
          if (event.type === 'houseEnter') {
            enterCount += 1;
          } else if (event.type === 'houseExit') {
            exitCount += 1;
          }
        }
        if (i > 0 && i % 250 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      expect(sawInside).toBe(true);
      expect(enterCount).toBeGreaterThan(0);
      expect(exitCount).toBeGreaterThan(0);
    },
    240_000,
  );
});
