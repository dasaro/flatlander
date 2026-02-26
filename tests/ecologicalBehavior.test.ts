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
import { countPeaksAndTroughs, movingAverage, oscillationAmplitude } from '../src/tools/demographyMetrics';
import { describeLong } from './longTest';

const TOTAL_TICKS = 6_000;
const SAMPLE_EVERY = 100;

function createSystems() {
  return [
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
  ];
}

describeLong('ecological behavior', () => {
  it(
    'seed 42 shows rain-driven shelter usage and boom-bust dynamics',
    async () => {
      const world = createDefaultWorld(42);
      const sim = new FixedTimestepSimulation(world, createSystems());
      const populationSeries: number[] = [world.entities.size];

      let rainShelterEntries = 0;
      let totalHouseEntries = 0;
      let rainyIntentTicks = 0;
      let occupiedTicks = 0;

      for (let tick = 1; tick <= TOTAL_TICKS; tick += 1) {
        sim.stepOneTick();
        if (tick % SAMPLE_EVERY === 0) {
          populationSeries.push(world.entities.size);
        }
        if (world.weather.isRaining && world.seekShelterIntentCount > 0) {
          rainyIntentTicks += 1;
        }
        if (world.insideCountThisTick > 0) {
          occupiedTicks += 1;
        }
        const events = world.events.drain();
        for (const event of events) {
          if (event.type === 'houseEnter') {
            totalHouseEntries += 1;
            if (world.weather.isRaining || event.reason === 'RainShelter') {
              rainShelterEntries += 1;
            }
          }
        }
        if (tick % 250 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      const smoothed = movingAverage(populationSeries, 7);
      const extrema = countPeaksAndTroughs(smoothed);
      const amplitude = oscillationAmplitude(smoothed.slice(-30));
      const minPopulation = Math.min(...populationSeries);
      const maxPopulation = Math.max(...populationSeries);

      expect(rainyIntentTicks).toBeGreaterThan(300);
      expect(totalHouseEntries).toBeGreaterThan(5);
      expect(rainShelterEntries).toBeGreaterThan(1);
      expect(occupiedTicks).toBeGreaterThan(120);
      expect(extrema.peaks).toBeGreaterThanOrEqual(2);
      expect(extrema.troughs).toBeGreaterThanOrEqual(2);
      expect(extrema.alternatingTransitions).toBeGreaterThanOrEqual(3);
      expect(amplitude).toBeGreaterThanOrEqual(0.24);
      expect(maxPopulation).toBeGreaterThanOrEqual(90);
      expect(minPopulation).toBeLessThanOrEqual(70);
    },
    120_000,
  );
});
