import { describe, expect, it } from 'vitest';

import { FixedTimestepSimulation } from '../src/core/simulation';
import { createDefaultWorld } from '../src/presets/defaultScenario';
import type { World } from '../src/core/world';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { CompensationSystem } from '../src/systems/compensationSystem';
import { CrowdStressSystem } from '../src/systems/crowdStressSystem';
import { ErosionSystem } from '../src/systems/erosionSystem';
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
import { movingAverage, countPeaksAndTroughs, oscillationAmplitude } from '../src/tools/demographyMetrics';
import { DEMO_SEEDS } from './demographySeeds';

const TOTAL_TICKS = 3_000;
const SAMPLE_EVERY = 100;
const LAST_WINDOW_TICKS = 2_000;
const SMOOTH_WINDOW = 5;
const TEST_SEEDS: number[] = [DEMO_SEEDS[0]!, DEMO_SEEDS[1]!, DEMO_SEEDS[4]!];

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
    new LethalitySystem(),
    new CleanupSystem(),
    new ReproductionSystem(),
    new NeoTherapySystem(),
  ];
}

interface CycleSnapshot {
  minPopulation: number;
  maxPopulation: number;
  diversity: number;
  amplitude: number;
  peaks: number;
  troughs: number;
  alternatingTransitions: number;
}

function majorCategories(world: World): Set<string> {
  const categories = new Set<string>();
  for (const id of world.entities) {
    const rank = world.ranks.get(id)?.rank;
    if (!rank) {
      continue;
    }
    categories.add(rank);
  }
  return categories;
}

function runCycleProbe(seed: number): CycleSnapshot {
  const world = createDefaultWorld(seed);
  const sim = new FixedTimestepSimulation(world, createSystems());
  const windowSamples = Math.max(1, Math.round(LAST_WINDOW_TICKS / SAMPLE_EVERY));

  const series: number[] = [world.entities.size];
  const categoryHistory: Set<string>[] = [majorCategories(world)];

  for (let tick = 1; tick <= TOTAL_TICKS; tick += 1) {
    sim.stepOneTick();
    if (tick % SAMPLE_EVERY === 0) {
      series.push(world.entities.size);
      categoryHistory.push(majorCategories(world));
    }
  }

  const smoothed = movingAverage(series, SMOOTH_WINDOW);
  const rawWindow = series.slice(-windowSamples);
  const smoothWindow = smoothed.slice(-windowSamples);
  const extrema = countPeaksAndTroughs(smoothWindow);

  const categoryWindow = categoryHistory.slice(-windowSamples);
  const union = new Set<string>();
  for (const snapshot of categoryWindow) {
    for (const key of snapshot) {
      union.add(key);
    }
  }

  return {
    minPopulation: Math.min(...rawWindow),
    maxPopulation: Math.max(...rawWindow),
    diversity: union.size,
    amplitude: oscillationAmplitude(smoothWindow),
    peaks: extrema.peaks,
    troughs: extrema.troughs,
    alternatingTransitions: extrema.alternatingTransitions,
  };
}

describe('demography cycles (multi-seed)', () => {
  for (const seed of TEST_SEEDS) {
    it(
      `seed ${seed} exhibits bounded cyclic dynamics with rank diversity`,
      () => {
        const cycle = runCycleProbe(seed);
        expect(cycle.minPopulation, `seed ${seed} min population`).toBeGreaterThanOrEqual(20);
        expect(cycle.maxPopulation, `seed ${seed} max population`).toBeLessThanOrEqual(650);
        expect(cycle.diversity, `seed ${seed} rank diversity`).toBeGreaterThanOrEqual(4);
        expect(cycle.amplitude, `seed ${seed} oscillation amplitude`).toBeGreaterThanOrEqual(0.015);
        expect(cycle.peaks, `seed ${seed} peaks`).toBeGreaterThanOrEqual(1);
        expect(cycle.troughs, `seed ${seed} troughs`).toBeGreaterThanOrEqual(1);
        expect(cycle.alternatingTransitions, `seed ${seed} alternation`).toBeGreaterThanOrEqual(1);
      },
      45_000,
    );
  }
});
