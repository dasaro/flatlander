import { expect, it } from 'vitest';

import { FixedTimestepSimulation } from '../src/core/simulation';
import { createDefaultWorld } from '../src/presets/defaultScenario';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { CompensationSystem } from '../src/systems/compensationSystem';
import { CrowdStressSystem } from '../src/systems/crowdStressSystem';
import { ErosionSystem } from '../src/systems/erosionSystem';
import { AgeDeteriorationSystem } from '../src/systems/ageDeteriorationSystem';
import { FeelingApproachSystem } from '../src/systems/feelingApproachSystem';
import { FeelingSystem } from '../src/systems/feelingSystem';
import { HearingSystem } from '../src/systems/hearingSystem';
import { HouseSystem } from '../src/systems/houseSystem';
import { IntelligenceGrowthSystem } from '../src/systems/intelligenceGrowthSystem';
import { IntroductionIntentSystem } from '../src/systems/introductionIntentSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { NeoTherapySystem } from '../src/systems/neoTherapySystem';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';
import { RainSystem } from '../src/systems/rainSystem';
import { RegularizationSystem } from '../src/systems/regularizationSystem';
import { ReproductionSystem } from '../src/systems/reproductionSystem';
import { SleepSystem } from '../src/systems/sleepSystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../src/systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../src/systems/southAttractionSystem';
import { StillnessControllerSystem } from '../src/systems/stillnessControllerSystem';
import { SwaySystem } from '../src/systems/swaySystem';
import { VisionSystem } from '../src/systems/visionSystem';
import { describeLong } from './longTest';

describeLong('mid-run smoke', () => {
  it(
    'shows rain-driven shelter usage in a 10k deterministic run (seed 42)',
    async () => {
      const world = createDefaultWorld(42);
      const simulation = new FixedTimestepSimulation(world, [
        new PeaceCrySystem(),
        new RainSystem(),
        new HearingSystem(),
        new VisionSystem(),
        new SocialNavMindSystem(),
        new FeelingApproachSystem(),
        new IntroductionIntentSystem(),
        new StillnessControllerSystem(),
        new SouthAttractionSystem(),
        new IntelligenceGrowthSystem(),
        new SleepSystem(),
        new SocialNavSteeringSystem(),
        new AvoidanceSteeringSystem(),
        new MovementSystem(),
        new SwaySystem(),
        new CrowdStressSystem(),
        new CompensationSystem(),
        new RegularizationSystem(),
        new CollisionSystem(),
        new HouseSystem(),
        new FeelingSystem(),
        new CollisionResolutionSystem(),
        new ErosionSystem(),
        new AgeDeteriorationSystem(),
        new LethalitySystem(),
        new CleanupSystem(),
        new ReproductionSystem(),
        new NeoTherapySystem(),
      ]);

      let rainInsideTicks = 0;
      let rainInsideSum = 0;
      let dryInsideTicks = 0;
      let dryInsideSum = 0;
      let houseEnters = 0;
      let houseExits = 0;

      for (let tick = 0; tick < 10_000; tick += 1) {
        simulation.stepOneTick();
        if (world.weather.isRaining) {
          rainInsideTicks += 1;
          rainInsideSum += world.insideCountThisTick;
        } else {
          dryInsideTicks += 1;
          dryInsideSum += world.insideCountThisTick;
        }
        const events = world.events.drain();
        for (const event of events) {
          if (event.type === 'houseEnter') {
            houseEnters += 1;
          } else if (event.type === 'houseExit') {
            houseExits += 1;
          }
        }
        if (tick % 250 === 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        }
      }

      const rainMean = rainInsideTicks > 0 ? rainInsideSum / rainInsideTicks : 0;
      const dryMean = dryInsideTicks > 0 ? dryInsideSum / dryInsideTicks : 0;
      expect(houseEnters).toBeGreaterThan(0);
      expect(houseExits).toBeGreaterThan(0);
      expect(rainMean).toBeGreaterThan(dryMean);
    },
    150_000,
  );
});
