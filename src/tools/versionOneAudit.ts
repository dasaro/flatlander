import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Rank } from '../core/rank';
import { createDefaultSimulation, createDefaultSystems } from '../presets/defaultSimulation';
import { RELEASE_PRESET_ID } from '../presets/releasePreset';
import { auditDefaultSystemStack } from './versionOneReadiness';

const DEFAULT_SEEDS = [42, 7, 13];
const DEFAULT_TICKS = 4_000;

interface SeedAudit {
  seed: number;
  ticks: number;
  survived: boolean;
  houseEnters: number;
  rainInsideTicks: number;
  housesUsed: number;
  rareSeen: boolean;
}

interface VersionOneAuditReport {
  generatedAt: string;
  preset: string;
  ticks: number;
  planPresent: boolean;
  systemStack: ReturnType<typeof auditDefaultSystemStack>;
  seeds: SeedAudit[];
  passed: boolean;
}

function runSeed(seed: number, ticks: number): SeedAudit {
  const simulation = createDefaultSimulation(seed);
  const { world } = simulation;
  const housesUsed = new Set<number>();
  let houseEnters = 0;
  let rainInsideTicks = 0;
  let rareSeen = false;

  for (let tick = 0; tick < ticks; tick += 1) {
    simulation.stepOneTick();
    if (world.weather.isRaining && world.insideCountThisTick > 0) {
      rainInsideTicks += 1;
    }
    for (const id of world.entities) {
      const rank = world.ranks.get(id)?.rank;
      if (rank === Rank.NearCircle || rank === Rank.Priest) {
        rareSeen = true;
        break;
      }
    }
    const events = world.events.drain();
    for (const event of events) {
      if (event.type === 'houseEnter') {
        houseEnters += 1;
        housesUsed.add(event.houseId);
      }
    }
  }

  return {
    seed,
    ticks,
    survived: world.entities.size > 0,
    houseEnters,
    rainInsideTicks,
    housesUsed: housesUsed.size,
    rareSeen,
  };
}

function main(): void {
  const ticksArg = Number(process.argv[2] ?? DEFAULT_TICKS);
  const ticks = Number.isFinite(ticksArg) && ticksArg > 0 ? Math.round(ticksArg) : DEFAULT_TICKS;
  const planPresent = existsSync(join(process.cwd(), 'VERSION_1_PLAN.md'));
  const systemNames = createDefaultSystems().map((system) => system.constructor.name);
  const systemStack = auditDefaultSystemStack(systemNames);
  const seeds = DEFAULT_SEEDS.map((seed) => runSeed(seed, ticks));

  const passed =
    planPresent &&
    systemStack.ok &&
    seeds.every((seed) => seed.survived && seed.houseEnters > 0 && seed.rainInsideTicks > 0);

  const report: VersionOneAuditReport = {
    generatedAt: new Date().toISOString(),
    preset: RELEASE_PRESET_ID,
    ticks,
    planPresent,
    systemStack,
    seeds,
    passed,
  };

  const artifactDir = join(process.cwd(), '.artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = join(artifactDir, 'version_one_audit.json');
  writeFileSync(artifactPath, JSON.stringify(report, null, 2));

  console.log(`preset=${RELEASE_PRESET_ID}`);
  console.log(`planPresent=${planPresent ? 'yes' : 'no'}`);
  console.log(
    `systemStack=${systemStack.ok ? 'ok' : 'FAIL'}${systemStack.issues.length > 0 ? ` (${systemStack.issues.join('; ')})` : ''}`,
  );
  for (const seed of seeds) {
    console.log(
      `seed=${seed.seed} survived=${seed.survived ? 'yes' : 'no'} houseEnters=${seed.houseEnters} rainInsideTicks=${seed.rainInsideTicks} housesUsed=${seed.housesUsed} rareSeen=${seed.rareSeen ? 'yes' : 'no'}`,
    );
  }
  console.log(`artifact=${artifactPath}`);

  if (!passed) {
    console.log('FAIL: version-one readiness audit not yet green.');
    process.exitCode = 1;
    return;
  }
  console.log('PASS: version-one readiness audit green.');
}

main();
