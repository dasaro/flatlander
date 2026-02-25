import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { spawnFromRequest, type SpawnRequest } from '../core/factory';
import { Rank, RankTag } from '../core/rank';
import { FixedTimestepSimulation } from '../core/simulation';
import { createWorld } from '../core/world';
import { spawnHouses } from '../core/worldgen/houses';
import { AvoidanceSteeringSystem } from '../systems/avoidanceSteeringSystem';
import { CleanupSystem } from '../systems/cleanupSystem';
import { CollisionResolutionSystem } from '../systems/collisionResolutionSystem';
import { CollisionSystem } from '../systems/collisionSystem';
import { CompensationSystem } from '../systems/compensationSystem';
import { CrowdStressSystem } from '../systems/crowdStressSystem';
import { ErosionSystem } from '../systems/erosionSystem';
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

const DEFAULT_SEEDS = [11, 23, 37, 53];
const DEFAULT_TICKS = 20_000;
const SAMPLE_EVERY_TICKS = 200;
const WINDOW_TICKS = 40_000;

const LONG_HORIZON_TICKS = 120_000;
const WARMUP_TICKS = 10_000;

interface Distribution {
  women: number;
  isosceles: number;
  equilateral: number;
  gentlemen: number;
  nobles: number;
  nearCircle: number;
  priests: number;
  irregular: number;
  total: number;
  births: number;
  deaths: number;
  avgGeneration: number;
}

interface DemographySample {
  tick: number;
  totalAlive: number;
  women: number;
  isosceles: number;
  equilateral: number;
  gentlemen: number;
  nobles: number;
  nearCircle: number;
  priests: number;
  irregular: number;
  insideCount: number;
  birthsWindow: number;
  deathsWindow: number;
  shannon: number;
}

interface SeedMetrics {
  amplitude: number;
  avgShannon: number;
  ranksPresentInWindow: number;
  nearCircleOrPriestSeen: boolean;
  irregularSeen: boolean;
  occupiedWithinFirst10k: boolean;
  avgInsideAfterWarmup: number;
  maxHouseContactStreak: number;
  boundedPopulation: boolean;
}

interface SeedReport {
  seed: number;
  final: Distribution;
  metrics: SeedMetrics;
  samples: DemographySample[];
}

interface AcceptanceThresholds {
  minAmplitude: number;
  minShannon: number;
  minRanksPresent: number;
  minPopulation: number;
  maxPopulation: number;
  maxContactStreak: number;
}

function acceptanceForTicks(ticks: number): AcceptanceThresholds {
  if (ticks >= LONG_HORIZON_TICKS) {
    return {
      minAmplitude: 0.12,
      minShannon: 1.1,
      minRanksPresent: 5,
      minPopulation: 20,
      maxPopulation: 650,
      maxContactStreak: 400,
    };
  }
  return {
    minAmplitude: 0.08,
    minShannon: 0.95,
    minRanksPresent: 4,
    minPopulation: 20,
    maxPopulation: 700,
    maxContactStreak: 420,
  };
}

function defaultPlan(): SpawnRequest[] {
  return [
    {
      shape: { kind: 'segment', size: 22 },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 14,
        maxTurnRate: 1.45,
        decisionEveryTicks: 20,
        intentionMinTicks: 95,
      },
      count: 28,
    },
    {
      shape: { kind: 'polygon', sides: 3, size: 16, irregular: false, triangleKind: 'Equilateral' },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 14,
        maxTurnRate: 1.15,
        decisionEveryTicks: 18,
        intentionMinTicks: 88,
      },
      count: 16,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 3,
        size: 17,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.08,
      },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 16,
        maxTurnRate: 1.3,
        decisionEveryTicks: 14,
        intentionMinTicks: 72,
      },
      count: 13,
    },
    {
      shape: { kind: 'polygon', sides: 4, size: 18, irregular: false },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 13,
        maxTurnRate: 1,
        decisionEveryTicks: 20,
        intentionMinTicks: 96,
      },
      count: 8,
    },
    {
      shape: { kind: 'polygon', sides: 5, size: 19, irregular: false },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 13,
        maxTurnRate: 1,
        decisionEveryTicks: 20,
        intentionMinTicks: 96,
      },
      count: 6,
    },
    {
      shape: { kind: 'polygon', sides: 6, size: 19, irregular: false },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 11,
        maxTurnRate: 0.82,
        decisionEveryTicks: 22,
        intentionMinTicks: 105,
      },
      count: 4,
    },
    {
      shape: { kind: 'polygon', sides: 7, size: 20, irregular: true },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 15,
        maxTurnRate: 1.2,
        decisionEveryTicks: 16,
        intentionMinTicks: 75,
      },
      count: 3,
    },
    {
      shape: { kind: 'polygon', sides: 15, size: 20, irregular: false },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 8,
        maxTurnRate: 0.7,
        decisionEveryTicks: 24,
        intentionMinTicks: 122,
      },
      count: 1,
    },
    {
      shape: { kind: 'circle', size: 14 },
      movement: {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 7,
        maxTurnRate: 0.62,
        decisionEveryTicks: 25,
        intentionMinTicks: 128,
      },
      count: 1,
    },
  ];
}

function countBirths(world: ReturnType<typeof createWorld>): number {
  return [...world.lineage.values()].filter(
    (lineage) => lineage.motherId !== null && lineage.fatherId !== null,
  ).length;
}

function distributionFromWorld(world: ReturnType<typeof createWorld>, initialPopulation: number): Distribution {
  let women = 0;
  let isosceles = 0;
  let equilateral = 0;
  let gentlemen = 0;
  let nobles = 0;
  let nearCircle = 0;
  let priests = 0;
  let irregular = 0;
  let generationSum = 0;

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
        if (rank.tags.includes(RankTag.Isosceles)) {
          isosceles += 1;
        } else {
          equilateral += 1;
        }
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

    generationSum += world.lineage.get(id)?.generation ?? 0;
  }

  const births = countBirths(world);
  const deaths = Math.max(0, initialPopulation + births - world.entities.size);

  return {
    women,
    isosceles,
    equilateral,
    gentlemen,
    nobles,
    nearCircle,
    priests,
    irregular,
    total: world.entities.size,
    births,
    deaths,
    avgGeneration: world.entities.size > 0 ? generationSum / world.entities.size : 0,
  };
}

function shannonIndex(
  sample: Pick<
    Distribution,
    'women' | 'isosceles' | 'equilateral' | 'gentlemen' | 'nobles' | 'nearCircle' | 'priests' | 'irregular' | 'total'
  >,
): number {
  if (sample.total <= 0) {
    return 0;
  }
  const values = [
    sample.women,
    sample.isosceles,
    sample.equilateral,
    sample.gentlemen,
    sample.nobles,
    sample.nearCircle,
    sample.priests,
    sample.irregular,
  ];
  let h = 0;
  for (const value of values) {
    if (value <= 0) {
      continue;
    }
    const p = value / sample.total;
    h -= p * Math.log(p);
  }
  return h;
}

function pct(value: number, total: number): string {
  if (total <= 0) {
    return '0.0%';
  }
  return `${((value / total) * 100).toFixed(1)}%`;
}

function computeMetrics(samples: DemographySample[]): SeedMetrics {
  if (samples.length === 0) {
    return {
      amplitude: 0,
      avgShannon: 0,
      ranksPresentInWindow: 0,
      nearCircleOrPriestSeen: false,
      irregularSeen: false,
      occupiedWithinFirst10k: false,
      avgInsideAfterWarmup: 0,
      maxHouseContactStreak: 0,
      boundedPopulation: false,
    };
  }

  const latestTick = samples[samples.length - 1]!.tick;
  const windowStartTick = Math.max(0, latestTick - WINDOW_TICKS);
  const windowSamples = samples.filter((sample) => sample.tick >= windowStartTick);
  const totals = windowSamples.map((sample) => sample.totalAlive);
  const maxTotal = Math.max(...totals, 0);
  const minTotal = Math.min(...totals, 0);
  const meanTotal = totals.reduce((sum, value) => sum + value, 0) / Math.max(1, totals.length);
  const amplitude = meanTotal > 0 ? (maxTotal - minTotal) / meanTotal : 0;
  const avgShannon =
    windowSamples.reduce((sum, sample) => sum + sample.shannon, 0) / Math.max(1, windowSamples.length);

  const ranksPresent = new Set<string>();
  for (const sample of windowSamples) {
    if (sample.women > 0) {
      ranksPresent.add('women');
    }
    if (sample.isosceles > 0) {
      ranksPresent.add('isosceles');
    }
    if (sample.equilateral > 0) {
      ranksPresent.add('equilateral');
    }
    if (sample.gentlemen > 0) {
      ranksPresent.add('gentlemen');
    }
    if (sample.nobles > 0) {
      ranksPresent.add('nobles');
    }
    if (sample.nearCircle > 0) {
      ranksPresent.add('nearCircle');
    }
    if (sample.priests > 0) {
      ranksPresent.add('priests');
    }
    if (sample.irregular > 0) {
      ranksPresent.add('irregular');
    }
  }

  const nearCircleOrPriestSeen = samples.some((sample) => sample.nearCircle > 0 || sample.priests > 0);
  const irregularSeen = samples.some((sample) => sample.irregular > 0);
  const occupiedWithinFirst10k = samples.some((sample) => sample.tick <= 10_000 && sample.insideCount > 0);
  const afterWarmup = samples.filter((sample) => sample.tick >= WARMUP_TICKS);
  const avgInsideAfterWarmup =
    afterWarmup.reduce((sum, sample) => sum + sample.insideCount, 0) / Math.max(1, afterWarmup.length);
  const maxHouseContactStreak = 0;
  const boundedPopulation =
    afterWarmup.length > 0
      ? afterWarmup.every((sample) => sample.totalAlive >= 120 && sample.totalAlive <= 650)
      : false;

  return {
    amplitude,
    avgShannon,
    ranksPresentInWindow: ranksPresent.size,
    nearCircleOrPriestSeen,
    irregularSeen,
    occupiedWithinFirst10k,
    avgInsideAfterWarmup,
    maxHouseContactStreak,
    boundedPopulation,
  };
}

function runSeed(seed: number, ticks: number): SeedReport {
  const world = createWorld(seed, {
    housesEnabled: true,
    houseCount: 8,
    rainEnabled: true,
    rainPeriodTicks: 2200,
    rainDurationTicks: 540,
    crowdStressEnabled: true,
  });
  spawnHouses(world, world.rng, {
    housesEnabled: world.config.housesEnabled,
    houseCount: world.config.houseCount,
    houseSize: world.config.houseSize,
    houseMinSpacing: world.config.houseMinSpacing,
    allowSquareHouses: world.config.allowSquareHouses,
    allowTriangularForts: world.config.allowTriangularForts,
    townPopulation: world.config.townPopulation,
  });

  const plan = defaultPlan();
  for (const request of plan) {
    spawnFromRequest(world, request);
  }
  const initialPopulation = world.entities.size;

  const systems = [
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

  const simulation = new FixedTimestepSimulation(world, systems);
  const samples: DemographySample[] = [];
  let previousBirths = 0;
  let previousDeaths = 0;
  let occupiedWithinFirst10k = false;
  let insideAfterWarmupTotal = 0;
  let insideAfterWarmupSamples = 0;
  let maxHouseContactStreak = 0;
  let boundedPopulation = true;
  const minPopulation = 20;
  const maxPopulation = 650;

  for (let i = 0; i < ticks; i += 1) {
    simulation.stepOneTick();
    for (const streak of world.houseContactStreaks.values()) {
      maxHouseContactStreak = Math.max(maxHouseContactStreak, streak.ticks);
    }

    let insideCount = 0;
    for (const dwelling of world.dwellings.values()) {
      if (dwelling.state === 'inside') {
        insideCount += 1;
      }
    }
    if (world.tick <= 10_000 && insideCount > 0) {
      occupiedWithinFirst10k = true;
    }
    if (world.tick >= WARMUP_TICKS) {
      insideAfterWarmupTotal += insideCount;
      insideAfterWarmupSamples += 1;
      if (world.entities.size < minPopulation || world.entities.size > maxPopulation) {
        boundedPopulation = false;
      }
    }

    if (world.tick % SAMPLE_EVERY_TICKS !== 0) {
      continue;
    }

    const dist = distributionFromWorld(world, initialPopulation);
    const birthsWindow = Math.max(0, dist.births - previousBirths);
    const deathsWindow = Math.max(0, dist.deaths - previousDeaths);
    previousBirths = dist.births;
    previousDeaths = dist.deaths;

    samples.push({
      tick: world.tick,
      totalAlive: dist.total,
      women: dist.women,
      isosceles: dist.isosceles,
      equilateral: dist.equilateral,
      gentlemen: dist.gentlemen,
      nobles: dist.nobles,
      nearCircle: dist.nearCircle,
      priests: dist.priests,
      irregular: dist.irregular,
      insideCount,
      birthsWindow,
      deathsWindow,
      shannon: shannonIndex(dist),
    });
  }

  const baseMetrics = computeMetrics(samples);
  const avgInsideAfterWarmup = insideAfterWarmupTotal / Math.max(1, insideAfterWarmupSamples);

  return {
    seed,
    final: distributionFromWorld(world, initialPopulation),
    metrics: {
      ...baseMetrics,
      occupiedWithinFirst10k,
      avgInsideAfterWarmup,
      maxHouseContactStreak,
      boundedPopulation,
    },
    samples,
  };
}

function parseTicksArg(): number {
  if (process.argv.includes('--full')) {
    return LONG_HORIZON_TICKS;
  }
  const arg = process.argv.find((value) => value.startsWith('--ticks='));
  if (!arg) {
    return DEFAULT_TICKS;
  }
  const ticks = Number.parseInt(arg.slice('--ticks='.length), 10);
  return Number.isFinite(ticks) && ticks > 0 ? ticks : DEFAULT_TICKS;
}

function shouldFailOnThresholds(): boolean {
  return !process.argv.includes('--no-fail');
}

const ticks = parseTicksArg();
const failOnThresholds = shouldFailOnThresholds();
const acceptance = acceptanceForTicks(ticks);
console.log(`Running stability seeds: ${DEFAULT_SEEDS.join(', ')} (ticks=${ticks})`);
const reports: SeedReport[] = [];
for (const seed of DEFAULT_SEEDS) {
  console.log(`... seed ${seed}`);
  reports.push(runSeed(seed, ticks));
}

const totals = reports.reduce(
  (acc, row) => {
    const d = row.final;
    return {
      women: acc.women + d.women,
      isosceles: acc.isosceles + d.isosceles,
      equilateral: acc.equilateral + d.equilateral,
      gentlemen: acc.gentlemen + d.gentlemen,
      nobles: acc.nobles + d.nobles,
      nearCircle: acc.nearCircle + d.nearCircle,
      priests: acc.priests + d.priests,
      irregular: acc.irregular + d.irregular,
      total: acc.total + d.total,
      births: acc.births + d.births,
      deaths: acc.deaths + d.deaths,
      avgGeneration: acc.avgGeneration + d.avgGeneration,
    };
  },
  {
    women: 0,
    isosceles: 0,
    equilateral: 0,
    gentlemen: 0,
    nobles: 0,
    nearCircle: 0,
    priests: 0,
    irregular: 0,
    total: 0,
    births: 0,
    deaths: 0,
    avgGeneration: 0,
  },
);

const avgGeneration = reports.length > 0 ? totals.avgGeneration / reports.length : 0;
const avgAmplitude = reports.reduce((sum, row) => sum + row.metrics.amplitude, 0) / Math.max(1, reports.length);
const avgShannon = reports.reduce((sum, row) => sum + row.metrics.avgShannon, 0) / Math.max(1, reports.length);
const avgRanksPresent =
  reports.reduce((sum, row) => sum + row.metrics.ranksPresentInWindow, 0) / Math.max(1, reports.length);
const rarePresenceCount = reports.filter((row) => row.metrics.nearCircleOrPriestSeen).length;
const occupied10kCount = reports.filter((row) => row.metrics.occupiedWithinFirst10k).length;
const avgInsideAfterWarmup =
  reports.reduce((sum, row) => sum + row.metrics.avgInsideAfterWarmup, 0) / Math.max(1, reports.length);
const maxContactStreakObserved = reports.reduce(
  (max, row) => Math.max(max, row.metrics.maxHouseContactStreak),
  0,
);
const boundedPopulationCount = reports.filter((row) => row.metrics.boundedPopulation).length;
const irregularSeenCount = reports.filter((row) => row.metrics.irregularSeen).length;

console.log(`Stability harness: ${reports.length} seeds x ${ticks} ticks (sampleEvery=${SAMPLE_EVERY_TICKS})`);
for (const row of reports) {
  const d = row.final;
  console.log(
    `seed=${row.seed} total=${d.total} women=${pct(d.women, d.total)} triangles=${pct(
      d.isosceles + d.equilateral,
      d.total,
    )} gentlemen=${pct(d.gentlemen, d.total)} nobles=${pct(d.nobles, d.total)} near+priests=${pct(
      d.nearCircle + d.priests,
      d.total
    )} irregular=${pct(d.irregular, d.total)} amp=${row.metrics.amplitude.toFixed(3)} H=${row.metrics.avgShannon.toFixed(
      3,
    )} ranks=${row.metrics.ranksPresentInWindow} rareSeen=${row.metrics.nearCircleOrPriestSeen ? 'yes' : 'no'} occupied10k=${
      row.metrics.occupiedWithinFirst10k ? 'yes' : 'no'
    } insideAvg=${row.metrics.avgInsideAfterWarmup.toFixed(2)} maxStreak=${row.metrics.maxHouseContactStreak} bounded=${
      row.metrics.boundedPopulation ? 'yes' : 'no'
    } births=${
      d.births
    } deaths=${d.deaths} avgGen=${d.avgGeneration.toFixed(2)}`,
  );
}

console.log('---- aggregate ----');
console.log(
  `total=${totals.total} women=${pct(totals.women, totals.total)} triangles=${pct(
    totals.isosceles + totals.equilateral,
    totals.total,
  )} gentlemen=${pct(totals.gentlemen, totals.total)} nobles=${pct(
    totals.nobles,
    totals.total
  )} near+priests=${pct(totals.nearCircle + totals.priests, totals.total)} irregular=${pct(
    totals.irregular,
    totals.total
  )} births=${totals.births} deaths=${
    totals.deaths
  } avgGen=${avgGeneration.toFixed(2)}`,
);
console.log(
  `metrics: amp(avg)=${avgAmplitude.toFixed(3)} shannon(avg)=${avgShannon.toFixed(
    3,
  )} ranksPresent(avg)=${avgRanksPresent.toFixed(2)} occupied10k=${occupied10kCount}/${reports.length} insideAvg=${avgInsideAfterWarmup.toFixed(
    2,
  )} maxStreak=${maxContactStreakObserved} bounded=${boundedPopulationCount}/${reports.length} irregularSeen=${irregularSeenCount}/${reports.length} rarePresenceSeeds=${rarePresenceCount}/${reports.length}`,
);

const artifactsDir = join(process.cwd(), '.artifacts', 'demography');
mkdirSync(artifactsDir, { recursive: true });
const artifactPath = join(artifactsDir, `stability-${Date.now()}.json`);
writeFileSync(
  artifactPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      ticks,
      sampleEveryTicks: SAMPLE_EVERY_TICKS,
      windowTicks: WINDOW_TICKS,
      acceptance,
      summary: {
        avgAmplitude,
        avgShannon,
        avgRanksPresent,
        occupied10kCount,
        avgInsideAfterWarmup,
        maxContactStreakObserved,
        boundedPopulationCount,
        irregularSeenCount,
        rarePresenceCount,
      },
      reports,
    },
    null,
    2,
  ),
);
console.log(`artifact: ${artifactPath}`);

const failedChecks: string[] = [];
if (avgAmplitude < acceptance.minAmplitude) {
  failedChecks.push(
    `oscillation amplitude too low (${avgAmplitude.toFixed(3)} < ${acceptance.minAmplitude.toFixed(3)})`,
  );
}
if (avgShannon < acceptance.minShannon) {
  failedChecks.push(`rank diversity too low (${avgShannon.toFixed(3)} < ${acceptance.minShannon.toFixed(3)})`);
}
if (avgRanksPresent < acceptance.minRanksPresent) {
  failedChecks.push(
    `insufficient persistent rank presence (${avgRanksPresent.toFixed(2)} < ${acceptance.minRanksPresent})`,
  );
}
if (ticks >= 10_000 && occupied10kCount <= 0) {
  failedChecks.push('no house occupancy observed within first 10k ticks');
}
if (ticks >= 20_000 && avgInsideAfterWarmup <= 0) {
  failedChecks.push('average indoor occupancy after warmup is zero');
}
if (maxContactStreakObserved > acceptance.maxContactStreak) {
  failedChecks.push(
    `house-contact stuck streak too high (${maxContactStreakObserved} > ${acceptance.maxContactStreak})`,
  );
}
if (ticks >= LONG_HORIZON_TICKS && boundedPopulationCount <= 0) {
  failedChecks.push(
    `population exceeded configured long-run band [${acceptance.minPopulation}, ${acceptance.maxPopulation}] after warmup`,
  );
}
const requiresRarePresence = ticks >= LONG_HORIZON_TICKS;
if (requiresRarePresence && rarePresenceCount <= 0) {
  failedChecks.push('no NearCircle/Priest presence observed across stability seeds');
}
if (ticks >= LONG_HORIZON_TICKS && irregularSeenCount <= 0) {
  failedChecks.push('no irregular population observed in long-run window');
}

if (!requiresRarePresence) {
  console.log('note: NearCircle/Priest 120k-tick presence check skipped (run with --full for canonical horizon).');
}

if (failedChecks.length > 0) {
  console.log('FAIL checks:');
  for (const check of failedChecks) {
    console.log(` - ${check}`);
  }
  if (failOnThresholds) {
    process.exitCode = 1;
  }
} else {
  console.log('PASS checks: oscillation + diversity targets met.');
}
