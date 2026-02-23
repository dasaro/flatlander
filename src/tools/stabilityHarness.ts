import { spawnFromRequest, type SpawnRequest } from '../core/factory';
import { Rank, RankTag } from '../core/rank';
import { FixedTimestepSimulation } from '../core/simulation';
import { createWorld } from '../core/world';
import { AvoidanceSteeringSystem } from '../systems/avoidanceSteeringSystem';
import { CleanupSystem } from '../systems/cleanupSystem';
import { CollisionResolutionSystem } from '../systems/collisionResolutionSystem';
import { CollisionSystem } from '../systems/collisionSystem';
import { CompensationSystem } from '../systems/compensationSystem';
import { ErosionSystem } from '../systems/erosionSystem';
import { FeelingApproachSystem } from '../systems/feelingApproachSystem';
import { FeelingSystem } from '../systems/feelingSystem';
import { HearingSystem } from '../systems/hearingSystem';
import { IntelligenceGrowthSystem } from '../systems/intelligenceGrowthSystem';
import { LethalitySystem } from '../systems/lethalitySystem';
import { MovementSystem } from '../systems/movementSystem';
import { PeaceCrySystem } from '../systems/peaceCrySystem';
import { RegularizationSystem } from '../systems/regularizationSystem';
import { ReproductionSystem } from '../systems/reproductionSystem';
import { SocialNavMindSystem } from '../systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../systems/southAttractionSystem';
import { StillnessSystem } from '../systems/stillnessSystem';
import { SwaySystem } from '../systems/swaySystem';
import { VisionSystem } from '../systems/visionSystem';

const DEFAULT_SEEDS = [11, 23, 37, 53, 71, 97];
const DEFAULT_TICKS = 5_000;

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

interface Distribution {
  women: number;
  isosceles: number;
  equilateral: number;
  gentlemen: number;
  nobles: number;
  nearCircle: number;
  priests: number;
  total: number;
  births: number;
  deaths: number;
  avgGeneration: number;
}

function runSeed(seed: number, ticks: number): Distribution {
  const world = createWorld(seed, {
    housesEnabled: false,
    houseCount: 0,
  });
  const plan = defaultPlan();
  for (const request of plan) {
    spawnFromRequest(world, request);
  }
  const initialPopulation = world.entities.size;

  const systems = [
    new SouthAttractionSystem(),
    new IntelligenceGrowthSystem(),
    new StillnessSystem(),
    new PeaceCrySystem(),
    new HearingSystem(),
    new VisionSystem(),
    new SocialNavMindSystem(),
    new SocialNavSteeringSystem(),
    new AvoidanceSteeringSystem(),
    new FeelingApproachSystem(),
    new MovementSystem(),
    new SwaySystem(),
    new CompensationSystem(),
    new RegularizationSystem(),
    new CollisionSystem(),
    new FeelingSystem(),
    new CollisionResolutionSystem(),
    new ErosionSystem(),
    new LethalitySystem(),
    new CleanupSystem(),
    new ReproductionSystem(),
  ];
  const simulation = new FixedTimestepSimulation(world, systems);
  for (let i = 0; i < ticks; i += 1) {
    simulation.stepOneTick();
  }

  let women = 0;
  let isosceles = 0;
  let equilateral = 0;
  let gentlemen = 0;
  let nobles = 0;
  let nearCircle = 0;
  let priests = 0;
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
      default:
        break;
    }

    generationSum += world.lineage.get(id)?.generation ?? 0;
  }

  const births = [...world.lineage.values()].filter(
    (lineage) => lineage.motherId !== null && lineage.fatherId !== null,
  ).length;
  const deaths = Math.max(0, initialPopulation + births - world.entities.size);
  return {
    women,
    isosceles,
    equilateral,
    gentlemen,
    nobles,
    nearCircle,
    priests,
    total: world.entities.size,
    births,
    deaths,
    avgGeneration: world.entities.size > 0 ? generationSum / world.entities.size : 0,
  };
}

function pct(value: number, total: number): string {
  if (total <= 0) {
    return '0.0%';
  }
  return `${((value / total) * 100).toFixed(1)}%`;
}

function parseTicksArg(): number {
  const arg = process.argv.find((value) => value.startsWith('--ticks='));
  if (!arg) {
    return DEFAULT_TICKS;
  }
  const ticks = Number.parseInt(arg.slice('--ticks='.length), 10);
  return Number.isFinite(ticks) && ticks > 0 ? ticks : DEFAULT_TICKS;
}

const ticks = parseTicksArg();
const rows = DEFAULT_SEEDS.map((seed) => ({ seed, dist: runSeed(seed, ticks) }));

let totals: Distribution = {
  women: 0,
  isosceles: 0,
  equilateral: 0,
  gentlemen: 0,
  nobles: 0,
  nearCircle: 0,
  priests: 0,
  total: 0,
  births: 0,
  deaths: 0,
  avgGeneration: 0,
};

for (const row of rows) {
  totals = {
    women: totals.women + row.dist.women,
    isosceles: totals.isosceles + row.dist.isosceles,
    equilateral: totals.equilateral + row.dist.equilateral,
    gentlemen: totals.gentlemen + row.dist.gentlemen,
    nobles: totals.nobles + row.dist.nobles,
    nearCircle: totals.nearCircle + row.dist.nearCircle,
    priests: totals.priests + row.dist.priests,
    total: totals.total + row.dist.total,
    births: totals.births + row.dist.births,
    deaths: totals.deaths + row.dist.deaths,
    avgGeneration: totals.avgGeneration + row.dist.avgGeneration,
  };
}

const avgGeneration = rows.length > 0 ? totals.avgGeneration / rows.length : 0;

console.log(`Stability harness: ${rows.length} seeds x ${ticks} ticks`);
for (const row of rows) {
  const d = row.dist;
  console.log(
    `seed=${row.seed} total=${d.total} women=${pct(d.women, d.total)} triangles=${pct(
      d.isosceles + d.equilateral,
      d.total,
    )} gentlemen=${pct(d.gentlemen, d.total)} nobles=${pct(d.nobles, d.total)} near+priests=${pct(
      d.nearCircle + d.priests,
      d.total,
    )} births=${d.births} deaths=${d.deaths} avgGen=${d.avgGeneration.toFixed(2)}`,
  );
}

console.log('---- aggregate ----');
console.log(
  `total=${totals.total} women=${pct(totals.women, totals.total)} triangles=${pct(
    totals.isosceles + totals.equilateral,
    totals.total,
  )} gentlemen=${pct(totals.gentlemen, totals.total)} nobles=${pct(
    totals.nobles,
    totals.total,
  )} near+priests=${pct(totals.nearCircle + totals.priests, totals.total)} births=${totals.births} deaths=${totals.deaths} avgGen=${avgGeneration.toFixed(2)}`,
);
