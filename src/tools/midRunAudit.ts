import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { FixedTimestepSimulation } from '../core/simulation';
import { Rank } from '../core/rank';
import { isEntityOutside } from '../core/housing/dwelling';
import { createDefaultWorld } from '../presets/defaultScenario';
import { countPeaksAndTroughs, movingAverage, oscillationAmplitude } from './demographyMetrics';
import { AvoidanceSteeringSystem } from '../systems/avoidanceSteeringSystem';
import { CleanupSystem } from '../systems/cleanupSystem';
import { CollisionResolutionSystem } from '../systems/collisionResolutionSystem';
import { CollisionSystem } from '../systems/collisionSystem';
import { CompensationSystem } from '../systems/compensationSystem';
import { CrowdStressSystem } from '../systems/crowdStressSystem';
import { ErosionSystem } from '../systems/erosionSystem';
import { AgeDeteriorationSystem } from '../systems/ageDeteriorationSystem';
import { FeelingApproachSystem } from '../systems/feelingApproachSystem';
import { FeelingSystem } from '../systems/feelingSystem';
import { HearingSystem } from '../systems/hearingSystem';
import { HouseSystem } from '../systems/houseSystem';
import { IntelligenceGrowthSystem } from '../systems/intelligenceGrowthSystem';
import { IntroductionIntentSystem } from '../systems/introductionIntentSystem';
import { LethalitySystem } from '../systems/lethalitySystem';
import { MovementSystem } from '../systems/movementSystem';
import { NeoTherapySystem } from '../systems/neoTherapySystem';
import { PeaceCrySystem } from '../systems/peaceCrySystem';
import { RainSystem } from '../systems/rainSystem';
import { RegularizationSystem } from '../systems/regularizationSystem';
import { ReproductionSystem } from '../systems/reproductionSystem';
import { SleepSystem } from '../systems/sleepSystem';
import { SocialNavMindSystem } from '../systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../systems/southAttractionSystem';
import { StillnessControllerSystem } from '../systems/stillnessControllerSystem';
import { SwaySystem } from '../systems/swaySystem';
import { VisionSystem } from '../systems/visionSystem';

const DEFAULT_SEEDS = [42, 7, 13, 101];
const DEFAULT_TICKS = 80_000;
const SAMPLE_EVERY_TICKS = 200;
const ANALYSIS_WINDOW_TICKS = 30_000;
const RAIN_RESPONSE_HORIZON = 400;

interface PopulationSnapshot {
  tick: number;
  totalAlive: number;
  women: number;
  triangles: number;
  gentlemen: number;
  nobles: number;
  nearCircle: number;
  priests: number;
  irregular: number;
}

interface RainResponseWindow {
  baselineOutside: number;
  sampleAtTick: number;
  maxRatio: number;
}

interface RunSummary {
  seed: number;
  ticks: number;
  samples: PopulationSnapshot[];
  oscillationAmplitude: number;
  peaks: number;
  troughs: number;
  alternatingTransitions: number;
  avgInsideWhenRaining: number;
  avgInsideWhenDry: number;
  insideRainVsDryRatio: number;
  rainResponseMean: number;
  houseEnterCount: number;
  houseExitCount: number;
  newPriests: number;
  priestBirthEvents: number;
  priestPromotionEvents: number;
  housesUsed: number;
}

interface AggregateSummary {
  ticks: number;
  seeds: number[];
  generatedAt: string;
  runs: RunSummary[];
  acceptance: {
    required: MidRunAcceptance;
    cyclesPassingSeeds: number;
    rainShelterPassingSeeds: number;
    priestAppearancePassingSeeds: number;
    allPassed: boolean;
  };
}

interface MidRunAcceptance {
  minCycleSeeds: number;
  minRainShelterSeeds: number;
  minRainRatio: number;
  minRainResponse: number;
  minPriestSeeds: number;
}

function acceptanceForTicks(ticks: number): MidRunAcceptance {
  const priestRequirement = ticks >= 60_000 ? 1 : 0;
  return {
    minCycleSeeds: 3,
    minRainShelterSeeds: 3,
    minRainRatio: 1.2,
    minRainResponse: 0.7,
    minPriestSeeds: priestRequirement,
  };
}

function createSimulation(seed: number): FixedTimestepSimulation {
  const world = createDefaultWorld(seed);
  return new FixedTimestepSimulation(world, [
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
}

function summarizePopulation(sim: FixedTimestepSimulation): PopulationSnapshot {
  const { world } = sim;
  let women = 0;
  let triangles = 0;
  let gentlemen = 0;
  let nobles = 0;
  let nearCircle = 0;
  let priests = 0;
  let irregular = 0;

  for (const id of world.entities) {
    const rank = world.ranks.get(id);
    if (!rank) {
      continue;
    }
    switch (rank.rank) {
      case Rank.Woman:
        women += 1;
        break;
      case Rank.Triangle:
        triangles += 1;
        break;
      case Rank.Gentleman:
        gentlemen += 1;
        break;
      case Rank.Noble:
        nobles += 1;
        break;
      case Rank.NearCircle:
        nearCircle += 1;
        break;
      case Rank.Priest:
        priests += 1;
        break;
      case Rank.Irregular:
        irregular += 1;
        break;
      default:
        break;
    }
  }

  return {
    tick: world.tick,
    totalAlive: world.entities.size,
    women,
    triangles,
    gentlemen,
    nobles,
    nearCircle,
    priests,
    irregular,
  };
}

function rainResponseRatio(sim: FixedTimestepSimulation, baselineOutside: number): number {
  if (baselineOutside <= 0) {
    return 1;
  }
  const { world } = sim;
  const covered = world.insideCountThisTick + world.seekShelterIntentCount + world.seekHomeIntentCount;
  return Math.min(1, covered / baselineOutside);
}

function isShelterEligibleOutside(sim: FixedTimestepSimulation, id: number): boolean {
  const { world } = sim;
  if (world.staticObstacles.has(id)) {
    return false;
  }
  const movement = world.movements.get(id);
  if (!movement || movement.type !== 'socialNav') {
    return false;
  }
  return isEntityOutside(world, id);
}

function runSeed(seed: number, ticks: number): RunSummary {
  const simulation = createSimulation(seed);
  const { world } = simulation;
  const initialPriests = summarizePopulation(simulation).priests;
  let maxPriests = initialPriests;
  const samples: PopulationSnapshot[] = [summarizePopulation(simulation)];
  let rainInsideSum = 0;
  let rainTicks = 0;
  let dryInsideSum = 0;
  let dryTicks = 0;
  let houseEnterCount = 0;
  let houseExitCount = 0;
  let priestBirthEvents = 0;
  let priestPromotionEvents = 0;
  const housesUsed = new Set<number>();
  const rainResponseWindows: RainResponseWindow[] = [];
  const rainResponseRatios: number[] = [];
  let wasRaining = world.weather.isRaining;

  for (let step = 1; step <= ticks; step += 1) {
    simulation.stepOneTick();

    if (world.weather.isRaining) {
      rainInsideSum += world.insideCountThisTick;
      rainTicks += 1;
    } else {
      dryInsideSum += world.insideCountThisTick;
      dryTicks += 1;
    }

    if (!wasRaining && world.weather.isRaining) {
      let outsideCount = 0;
      for (const id of world.entities) {
        if (isShelterEligibleOutside(simulation, id)) {
          outsideCount += 1;
        }
      }
      rainResponseWindows.push({
        baselineOutside: outsideCount,
        sampleAtTick: world.tick + RAIN_RESPONSE_HORIZON,
        maxRatio: 0,
      });
    }
    wasRaining = world.weather.isRaining;

    for (let i = rainResponseWindows.length - 1; i >= 0; i -= 1) {
      const window = rainResponseWindows[i];
      if (!window) {
        continue;
      }
      window.maxRatio = Math.max(
        window.maxRatio,
        rainResponseRatio(simulation, window.baselineOutside),
      );
      if (world.tick < window.sampleAtTick) {
        continue;
      }
      rainResponseRatios.push(window.maxRatio);
      rainResponseWindows.splice(i, 1);
    }

    const events = world.events.drain();
    for (const event of events) {
      if (event.type === 'houseEnter') {
        houseEnterCount += 1;
        housesUsed.add(event.houseId);
      } else if (event.type === 'houseExit') {
        houseExitCount += 1;
      } else if (event.type === 'birth' && event.childRankKey === Rank.Priest) {
        priestBirthEvents += 1;
      } else if (event.type === 'regularized' && event.rankKey === Rank.Priest) {
        priestPromotionEvents += 1;
      }
    }

    if (step % SAMPLE_EVERY_TICKS === 0) {
      const snapshot = summarizePopulation(simulation);
      samples.push(snapshot);
      maxPriests = Math.max(maxPriests, snapshot.priests);
    }
  }

  const windowSamples = Math.max(3, Math.round(ANALYSIS_WINDOW_TICKS / SAMPLE_EVERY_TICKS));
  const tailSamples = samples.slice(-windowSamples);
  const totals = tailSamples.map((sample) => sample.totalAlive);
  const smoothed = movingAverage(totals, 9);
  const extrema = countPeaksAndTroughs(smoothed);
  const amplitude = oscillationAmplitude(smoothed);

  return {
    seed,
    ticks,
    samples,
    oscillationAmplitude: amplitude,
    peaks: extrema.peaks,
    troughs: extrema.troughs,
    alternatingTransitions: extrema.alternatingTransitions,
    avgInsideWhenRaining: rainTicks > 0 ? rainInsideSum / rainTicks : 0,
    avgInsideWhenDry: dryTicks > 0 ? dryInsideSum / dryTicks : 0,
    insideRainVsDryRatio: dryTicks > 0 && dryInsideSum > 0 ? (rainInsideSum / rainTicks) / (dryInsideSum / dryTicks) : 0,
    rainResponseMean:
      rainResponseRatios.length > 0
        ? rainResponseRatios.reduce((sum, ratio) => sum + ratio, 0) / rainResponseRatios.length
        : 0,
    houseEnterCount,
    houseExitCount,
    newPriests: Math.max(0, maxPriests - initialPriests),
    priestBirthEvents,
    priestPromotionEvents,
    housesUsed: housesUsed.size,
  };
}

function main(): void {
  const ticksArg = Number(process.argv[2] ?? DEFAULT_TICKS);
  const ticks = Number.isFinite(ticksArg) && ticksArg > 0 ? Math.round(ticksArg) : DEFAULT_TICKS;
  const runs = DEFAULT_SEEDS.map((seed) => runSeed(seed, ticks));

  for (const run of runs) {
    console.log(
      [
        `seed=${run.seed}`,
        `amp=${run.oscillationAmplitude.toFixed(3)}`,
        `peaks=${run.peaks}`,
        `troughs=${run.troughs}`,
        `rainRatio=${run.insideRainVsDryRatio.toFixed(2)}`,
        `rainResponse=${(run.rainResponseMean * 100).toFixed(1)}%`,
        `enter=${run.houseEnterCount}`,
        `exit=${run.houseExitCount}`,
        `housesUsed=${run.housesUsed}`,
        `newPriests=${run.newPriests}`,
        `priestPromotions=${run.priestPromotionEvents}`,
      ].join(' '),
    );
  }

  const acceptance = acceptanceForTicks(ticks);

  const cyclesPassingSeeds = runs.filter(
    (run) => run.oscillationAmplitude >= 0.1 && run.peaks >= 2 && run.troughs >= 2 && run.alternatingTransitions >= 4,
  ).length;
  const rainShelterPassingSeeds = runs.filter(
    (run) =>
      run.insideRainVsDryRatio >= acceptance.minRainRatio &&
      run.rainResponseMean >= acceptance.minRainResponse,
  ).length;
  const priestAppearancePassingSeeds = runs.filter(
    (run) => run.newPriests > 0 || run.priestBirthEvents > 0 || run.priestPromotionEvents > 0,
  ).length;
  const allPassed =
    cyclesPassingSeeds >= acceptance.minCycleSeeds &&
    rainShelterPassingSeeds >= acceptance.minRainShelterSeeds &&
    priestAppearancePassingSeeds >= acceptance.minPriestSeeds;

  const report: AggregateSummary = {
    generatedAt: new Date().toISOString(),
    ticks,
    seeds: DEFAULT_SEEDS,
    runs,
    acceptance: {
      required: acceptance,
      cyclesPassingSeeds,
      rainShelterPassingSeeds,
      priestAppearancePassingSeeds,
      allPassed,
    },
  };

  const artifactDir = join(process.cwd(), '.artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = join(artifactDir, 'midrun_report.json');
  writeFileSync(artifactPath, JSON.stringify(report, null, 2));
  console.log(`artifact=${artifactPath}`);

  if (!allPassed) {
    console.log('FAIL: mid-run ecology acceptance did not pass.');
    process.exitCode = 1;
    return;
  }
  console.log('PASS: mid-run ecology acceptance passed.');
}

main();
