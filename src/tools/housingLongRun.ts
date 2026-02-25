import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { FixedTimestepSimulation } from '../core/simulation';
import type { HouseTransitionReason } from '../core/events';
import { createDefaultWorld } from '../presets/defaultScenario';
import { AvoidanceSteeringSystem } from '../systems/avoidanceSteeringSystem';
import { CollisionSystem } from '../systems/collisionSystem';
import { HouseSystem } from '../systems/houseSystem';
import { MovementSystem } from '../systems/movementSystem';
import { RainSystem } from '../systems/rainSystem';
import { SocialNavMindSystem } from '../systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../systems/southAttractionSystem';
import { StillnessControllerSystem } from '../systems/stillnessControllerSystem';
import { SwaySystem } from '../systems/swaySystem';

const RUN_SEEDS = [42, 7, 13];
const TICKS = 120_000;
const ACCEPTANCE = {
  minEnters: 30,
  minExits: 25,
  minHousesUsed: 3,
};

type ReasonCounts = Record<HouseTransitionReason, number>;

interface RunSummary {
  seed: number;
  ticks: number;
  enters: number;
  exits: number;
  enterReasons: ReasonCounts;
  exitReasons: ReasonCounts;
  averageInsideCount: number;
  maxInsideCount: number;
  housesEverUsed: number;
  stuckNearHouseTicks: number;
  passes: {
    enters: boolean;
    exits: boolean;
    housesUsed: boolean;
  };
}

function emptyReasonCounts(): ReasonCounts {
  return {
    RainShelter: 0,
    ReturnHome: 0,
    Healing: 0,
    AvoidCrowd: 0,
    WaitForBearing: 0,
    Wander: 0,
  };
}

function createSimulation(seed: number): FixedTimestepSimulation {
  const world = createDefaultWorld(seed);
  // Lean deterministic stack for housing usage: keep rain, social intention,
  // movement, collision manifolds, and house transitions.
  return new FixedTimestepSimulation(world, [
    new RainSystem(),
    new SocialNavMindSystem(),
    new StillnessControllerSystem(),
    new SouthAttractionSystem(),
    new SocialNavSteeringSystem(),
    new AvoidanceSteeringSystem(),
    new MovementSystem(),
    new SwaySystem(),
    new CollisionSystem(),
    new HouseSystem(),
  ]);
}

function runSeed(seed: number, ticks: number): RunSummary {
  const simulation = createSimulation(seed);
  const { world } = simulation;
  const enterReasons = emptyReasonCounts();
  const exitReasons = emptyReasonCounts();
  const housesUsed = new Set<number>();
  let enters = 0;
  let exits = 0;
  let insideSamples = 0;
  let maxInsideCount = 0;
  let stuckNearHouseTicks = 0;

  for (let tick = 0; tick < ticks; tick += 1) {
    simulation.stepOneTick();
    insideSamples += world.insideCountThisTick;
    if (world.insideCountThisTick > maxInsideCount) {
      maxInsideCount = world.insideCountThisTick;
    }
    if (world.stuckNearHouseCount > 0) {
      stuckNearHouseTicks += 1;
    }

    const events = world.events.drain();
    for (const event of events) {
      if (event.type === 'houseEnter') {
        enters += 1;
        enterReasons[event.reason] += 1;
        housesUsed.add(event.houseId);
      } else if (event.type === 'houseExit') {
        exits += 1;
        exitReasons[event.reason] += 1;
      }
    }
  }

  return {
    seed,
    ticks,
    enters,
    exits,
    enterReasons,
    exitReasons,
    averageInsideCount: insideSamples / Math.max(1, ticks),
    maxInsideCount,
    housesEverUsed: housesUsed.size,
    stuckNearHouseTicks,
    passes: {
      enters: enters >= ACCEPTANCE.minEnters,
      exits: exits >= ACCEPTANCE.minExits,
      housesUsed: housesUsed.size >= ACCEPTANCE.minHousesUsed,
    },
  };
}

function printSummary(summary: RunSummary): void {
  console.log(
    [
      `seed=${summary.seed}`,
      `enters=${summary.enters}`,
      `exits=${summary.exits}`,
      `avgInside=${summary.averageInsideCount.toFixed(2)}`,
      `maxInside=${summary.maxInsideCount}`,
      `housesUsed=${summary.housesEverUsed}`,
      `stuckTicks=${summary.stuckNearHouseTicks}`,
      `pass=${summary.passes.enters && summary.passes.exits && summary.passes.housesUsed ? 'yes' : 'no'}`,
    ].join(' '),
  );
  console.log(`  enterReasons=${JSON.stringify(summary.enterReasons)}`);
  console.log(`  exitReasons=${JSON.stringify(summary.exitReasons)}`);
}

function main(): void {
  const summaries = RUN_SEEDS.map((seed) => {
    console.log(`running seed=${seed} ticks=${TICKS}`);
    return runSeed(seed, TICKS);
  });
  for (const summary of summaries) {
    printSummary(summary);
  }

  const allPassed = summaries.every((summary) =>
    summary.passes.enters && summary.passes.exits && summary.passes.housesUsed,
  );

  const artifact = {
    generatedAt: new Date().toISOString(),
    ticks: TICKS,
    seeds: RUN_SEEDS,
    acceptance: ACCEPTANCE,
    runs: summaries,
    allPassed,
  };

  const artifactDir = join(process.cwd(), '.artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = join(artifactDir, 'housing_runs.json');
  writeFileSync(artifactPath, JSON.stringify(artifact, null, 2));
  console.log(`artifact=${artifactPath}`);

  if (!allPassed) {
    console.log('FAIL: one or more housing long-run acceptance checks failed.');
    process.exitCode = 1;
    return;
  }

  console.log('PASS: housing long-run acceptance checks met for all seeds.');
}

main();
