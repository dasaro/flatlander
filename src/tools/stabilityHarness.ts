import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

import { Rank, RankTag } from '../core/rank';
import type { World } from '../core/world';
import { isEntityOutside } from '../core/housing/dwelling';
import { createDefaultSimulation } from '../presets/defaultSimulation';
import { RELEASE_PRESET_ID } from '../presets/releasePreset';
import { countPeaksAndTroughs, movingAverage } from './demographyMetrics';

const DEFAULT_SEEDS = [42, 7, 13, 101, 314, 1337, 2026, 9001];
const DEFAULT_TICKS = 20_000;
const SAMPLE_EVERY_TICKS = 200;
const WINDOW_TICKS = 40_000;
const STALLED_SEEKING_DISTANCE_EPS = 0.05;
const STALLED_SEEKING_TICKS_THRESHOLD = 180;

const LONG_HORIZON_TICKS = 120_000;
const WARMUP_TICKS = 10_000;
const FULL_PROGRESS_TICKS = 20_000;

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
  minPopulationWindow: number;
  maxPopulationWindow: number;
  peaks: number;
  troughs: number;
  alternatingTransitions: number;
  avgShannon: number;
  ranksPresentInWindow: number;
  nearCircleOrPriestSeen: boolean;
  irregularSeen: boolean;
  occupiedWithinFirst10k: boolean;
  avgInsideAfterWarmup: number;
  maxHouseContactStreak: number;
  stillTooLongCount: number;
  maxStillSeekingTicks: number;
  boundedPopulation: boolean;
}

interface SeedReport {
  seed: number;
  final: Distribution;
  metrics: SeedMetrics;
  samples: DemographySample[];
}

interface WorkerPayload {
  seed: number;
  elapsedSeconds: number;
  report: SeedReport;
}

interface AcceptanceThresholds {
  minAmplitude: number;
  minPeaks: number;
  minTroughs: number;
  minAlternatingTransitions: number;
  minShannon: number;
  minRanksPresent: number;
  minPopulation: number;
  maxPopulation: number;
  maxContactStreak: number;
  maxStillTooLongCount: number;
}

function acceptanceForTicks(ticks: number): AcceptanceThresholds {
  if (ticks >= LONG_HORIZON_TICKS) {
    return {
      minAmplitude: 0.12,
      minPeaks: 2,
      minTroughs: 2,
      minAlternatingTransitions: 4,
      minShannon: 0.95,
      minRanksPresent: 5,
      minPopulation: 20,
      maxPopulation: 650,
      maxContactStreak: 400,
      maxStillTooLongCount: 0,
    };
  }
  return {
    minAmplitude: 0.08,
    minPeaks: 1,
    minTroughs: 1,
    minAlternatingTransitions: 2,
    minShannon: 0.95,
    minRanksPresent: 4,
    minPopulation: 20,
    maxPopulation: 700,
    maxContactStreak: 420,
    maxStillTooLongCount: 0,
  };
}

function countBirths(world: World): number {
  return [...world.lineage.values()].filter(
    (lineage) => lineage.motherId !== null && lineage.fatherId !== null,
  ).length;
}

function distributionFromWorld(world: World, initialPopulation: number): Distribution {
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

function computeMetrics(
  samples: DemographySample[],
  acceptance: Pick<AcceptanceThresholds, 'minPopulation' | 'maxPopulation'>,
): SeedMetrics {
  if (samples.length === 0) {
    return {
      amplitude: 0,
      minPopulationWindow: 0,
      maxPopulationWindow: 0,
      peaks: 0,
      troughs: 0,
      alternatingTransitions: 0,
      avgShannon: 0,
      ranksPresentInWindow: 0,
      nearCircleOrPriestSeen: false,
      irregularSeen: false,
      occupiedWithinFirst10k: false,
      avgInsideAfterWarmup: 0,
      maxHouseContactStreak: 0,
      stillTooLongCount: 0,
      maxStillSeekingTicks: 0,
      boundedPopulation: false,
    };
  }

  const latestTick = samples[samples.length - 1]!.tick;
  const windowStartTick = Math.max(0, latestTick - WINDOW_TICKS);
  const windowSamples = samples.filter((sample) => sample.tick >= windowStartTick);
  const totals = windowSamples.map((sample) => sample.totalAlive);
  const maxTotal = totals.length > 0 ? Math.max(...totals) : 0;
  const minTotal = totals.length > 0 ? Math.min(...totals) : 0;
  const meanTotal = totals.reduce((sum, value) => sum + value, 0) / Math.max(1, totals.length);
  const amplitude = meanTotal > 0 ? (maxTotal - minTotal) / meanTotal : 0;
  const smoothedTotals = movingAverage(totals, 9);
  const extrema = countPeaksAndTroughs(smoothedTotals);
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
  const stillTooLongCount = 0;
  const maxStillSeekingTicks = 0;
  const boundedPopulation =
    afterWarmup.length > 0
      ? afterWarmup.every(
          (sample) =>
            sample.totalAlive >= acceptance.minPopulation &&
            sample.totalAlive <= acceptance.maxPopulation,
        )
      : false;

  return {
    amplitude,
    minPopulationWindow: minTotal,
    maxPopulationWindow: maxTotal,
    peaks: extrema.peaks,
    troughs: extrema.troughs,
    alternatingTransitions: extrema.alternatingTransitions,
    avgShannon,
    ranksPresentInWindow: ranksPresent.size,
    nearCircleOrPriestSeen,
    irregularSeen,
    occupiedWithinFirst10k,
    avgInsideAfterWarmup,
    maxHouseContactStreak,
    stillTooLongCount,
    maxStillSeekingTicks,
    boundedPopulation,
  };
}

function runSeed(seed: number, ticks: number, logProgress = true): SeedReport {
  const acceptance = acceptanceForTicks(ticks);
  const simulation = createDefaultSimulation(seed);
  const { world } = simulation;
  const initialPopulation = world.entities.size;
  const samples: DemographySample[] = [];
  let previousBirths = 0;
  let previousDeaths = 0;
  let occupiedWithinFirst10k = false;
  let insideAfterWarmupTotal = 0;
  let insideAfterWarmupSamples = 0;
  let maxHouseContactStreak = 0;
  let maxStillSeekingTicks = 0;
  let boundedPopulation = true;
  const stalledSeekingTicks = new Map<number, number>();
  const stillTooLongEntities = new Set<number>();
  const previousPositions = new Map<number, { x: number; y: number }>();
  const minPopulation = acceptance.minPopulation;
  const maxPopulation = acceptance.maxPopulation;
  const progressInterval =
    ticks >= LONG_HORIZON_TICKS ? FULL_PROGRESS_TICKS : ticks >= 20_000 ? 5_000 : 0;

  for (let i = 0; i < ticks; i += 1) {
    simulation.stepOneTick();
    world.events.drain();

    if (logProgress && progressInterval > 0 && world.tick % progressInterval === 0) {
      console.log(
        `   seed ${seed} progress: tick=${world.tick} alive=${world.entities.size} inside=${world.insideCountThisTick}`,
      );
    }

    for (const streak of world.houseContactStreaks.values()) {
      maxHouseContactStreak = Math.max(maxHouseContactStreak, streak.ticks);
    }

    for (const [id, movement] of world.movements) {
      const transform = world.transforms.get(id);
      if (!transform || movement.type !== 'socialNav') {
        stalledSeekingTicks.delete(id);
        continue;
      }
      const previous = previousPositions.get(id);
      previousPositions.set(id, {
        x: transform.position.x,
        y: transform.position.y,
      });

      const seeksHouse = movement.intention === 'seekShelter' || movement.intention === 'seekHome';
      if (
        !seeksHouse ||
        !isEntityOutside(world, id) ||
        world.stillness.has(id) ||
        world.sleep.get(id)?.asleep
      ) {
        stalledSeekingTicks.delete(id);
        continue;
      }

      if (!previous) {
        stalledSeekingTicks.set(id, 0);
        continue;
      }

      const displacement = Math.hypot(
        transform.position.x - previous.x,
        transform.position.y - previous.y,
      );
      const nextTicks =
        displacement <= STALLED_SEEKING_DISTANCE_EPS
          ? (stalledSeekingTicks.get(id) ?? 0) + 1
          : 0;
      stalledSeekingTicks.set(id, nextTicks);
      maxStillSeekingTicks = Math.max(maxStillSeekingTicks, nextTicks);
      if (nextTicks >= STALLED_SEEKING_TICKS_THRESHOLD) {
        stillTooLongEntities.add(id);
      }
    }

    for (const id of previousPositions.keys()) {
      if (world.entities.has(id)) {
        continue;
      }
      previousPositions.delete(id);
      stalledSeekingTicks.delete(id);
      stillTooLongEntities.delete(id);
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

  const baseMetrics = computeMetrics(samples, acceptance);
  const avgInsideAfterWarmup = insideAfterWarmupTotal / Math.max(1, insideAfterWarmupSamples);

  return {
    seed,
    final: distributionFromWorld(world, initialPopulation),
    metrics: {
      ...baseMetrics,
      occupiedWithinFirst10k,
      avgInsideAfterWarmup,
      maxHouseContactStreak,
      stillTooLongCount: stillTooLongEntities.size,
      maxStillSeekingTicks,
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

function parseSeedsArg(): number[] {
  const arg = process.argv.find((value) => value.startsWith('--seeds='));
  if (!arg) {
    return DEFAULT_SEEDS;
  }
  const parsed = arg
    .slice('--seeds='.length)
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));
  return parsed.length > 0 ? parsed : DEFAULT_SEEDS;
}

function parseWorkerSeedArg(): number | null {
  const arg = process.argv.find((value) => value.startsWith('--worker-seed='));
  if (!arg) {
    return null;
  }
  const parsed = Number.parseInt(arg.slice('--worker-seed='.length), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseJobsArg(seedCount: number, ticks: number): number {
  const arg = process.argv.find((value) => value.startsWith('--jobs='));
  if (arg) {
    const parsed = Number.parseInt(arg.slice('--jobs='.length), 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.min(seedCount, parsed));
    }
  }
  const usable = Math.max(1, availableParallelism() - 1);
  if (ticks >= LONG_HORIZON_TICKS) {
    return Math.max(1, Math.min(seedCount, Math.min(4, usable)));
  }
  return Math.max(1, Math.min(seedCount, Math.min(8, usable)));
}

async function runSeedWorker(seed: number, ticks: number): Promise<WorkerPayload> {
  return await new Promise((resolve, reject) => {
    const startedAt = process.hrtime.bigint();
    const child = spawn(
      join(process.cwd(), 'node_modules', '.bin', 'tsx'),
      ['src/tools/stabilityHarness.ts', `--worker-seed=${seed}`, `--ticks=${ticks}`],
      {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `seed ${seed} worker failed with code ${code}${stderr ? `\n${stderr}` : ''}`,
          ),
        );
        return;
      }
      const trimmed = stdout.trim();
      if (!trimmed) {
        reject(new Error(`seed ${seed} worker produced no output`));
        return;
      }
      try {
        const payload = JSON.parse(trimmed) as { report: SeedReport };
        resolve({
          seed,
          elapsedSeconds: Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
          report: payload.report,
        });
      } catch (error) {
        reject(
          new Error(
            `seed ${seed} worker output was not valid JSON:\n${trimmed}\n${stderr}`,
            { cause: error },
          ),
        );
      }
    });
  });
}

async function runSeeds(seeds: number[], ticks: number): Promise<Array<WorkerPayload>> {
  if (process.argv.includes('--serial') || seeds.length <= 1) {
    return seeds.map((seed) => {
      const startedAt = process.hrtime.bigint();
      const report = runSeed(seed, ticks, true);
      return {
        seed,
        elapsedSeconds: Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
        report,
      };
    });
  }

  const jobs = parseJobsArg(seeds.length, ticks);
  const queue = [...seeds];
  const results = new Map<number, WorkerPayload>();

  async function runNext(): Promise<void> {
    const seed = queue.shift();
    if (seed === undefined) {
      return;
    }
    console.log(`... seed ${seed}`);
    const payload = await runSeedWorker(seed, ticks);
    console.log(
      `... seed ${seed} done in ${payload.elapsedSeconds.toFixed(1)}s (final=${payload.report.final.total}, amp=${payload.report.metrics.amplitude.toFixed(3)}, H=${payload.report.metrics.avgShannon.toFixed(3)})`,
    );
    results.set(seed, payload);
    await runNext();
  }

  await Promise.all(Array.from({ length: jobs }, () => runNext()));
  return seeds.map((seed) => results.get(seed)!).filter(Boolean);
}

async function main(): Promise<void> {
  const workerSeed = parseWorkerSeedArg();
  const ticks = parseTicksArg();
  if (workerSeed !== null) {
    const report = runSeed(workerSeed, ticks, false);
    process.stdout.write(JSON.stringify({ seed: workerSeed, report }));
    return;
  }

  const failOnThresholds = shouldFailOnThresholds();
  const seeds = parseSeedsArg();
  const acceptance = acceptanceForTicks(ticks);
  console.log(
    `Running stability seeds: ${seeds.join(', ')} (ticks=${ticks}, preset=${RELEASE_PRESET_ID})`,
  );
  const reports = (await runSeeds(seeds, ticks)).map((payload) => payload.report);

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
  const stillTooLongMaxObserved = reports.reduce(
    (max, row) => Math.max(max, row.metrics.stillTooLongCount),
    0,
  );
  const maxStillSeekingTicksObserved = reports.reduce(
    (max, row) => Math.max(max, row.metrics.maxStillSeekingTicks),
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
      )} irregular=${pct(d.irregular, d.total)} amp=${row.metrics.amplitude.toFixed(3)} peaks=${row.metrics.peaks} troughs=${row.metrics.troughs} alt=${row.metrics.alternatingTransitions} H=${row.metrics.avgShannon.toFixed(
        3,
      )} min/max=${row.metrics.minPopulationWindow}/${row.metrics.maxPopulationWindow} ranks=${row.metrics.ranksPresentInWindow} rareSeen=${row.metrics.nearCircleOrPriestSeen ? 'yes' : 'no'} occupied10k=${
        row.metrics.occupiedWithinFirst10k ? 'yes' : 'no'
      } insideAvg=${row.metrics.avgInsideAfterWarmup.toFixed(2)} maxStreak=${row.metrics.maxHouseContactStreak} stillTooLong=${row.metrics.stillTooLongCount} stillMax=${row.metrics.maxStillSeekingTicks} bounded=${
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
    )} maxStreak=${maxContactStreakObserved} stillTooLong(max)=${stillTooLongMaxObserved} stillTicksMax=${maxStillSeekingTicksObserved} bounded=${boundedPopulationCount}/${reports.length} irregularSeen=${irregularSeenCount}/${reports.length} rarePresenceSeeds=${rarePresenceCount}/${reports.length}`,
  );

  const artifactsDir = join(process.cwd(), '.artifacts', 'demography');
  mkdirSync(artifactsDir, { recursive: true });
  const artifactPath = join(artifactsDir, `stability-${Date.now()}.json`);
  const artifactTempPath = `${artifactPath}.tmp`;
  writeFileSync(
    artifactTempPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        preset: RELEASE_PRESET_ID,
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
          stillTooLongMaxObserved,
          maxStillSeekingTicksObserved,
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
  renameSync(artifactTempPath, artifactPath);
  console.log(`artifact: ${artifactPath}`);

  const failedChecks: string[] = [];
  if (avgAmplitude < acceptance.minAmplitude) {
    failedChecks.push(
      `oscillation amplitude too low (${avgAmplitude.toFixed(3)} < ${acceptance.minAmplitude.toFixed(3)})`,
    );
  }
  for (const row of reports) {
    if (row.metrics.peaks < acceptance.minPeaks) {
      failedChecks.push(
        `seed ${row.seed}: insufficient peaks (${row.metrics.peaks} < ${acceptance.minPeaks})`,
      );
    }
    if (row.metrics.troughs < acceptance.minTroughs) {
      failedChecks.push(
        `seed ${row.seed}: insufficient troughs (${row.metrics.troughs} < ${acceptance.minTroughs})`,
      );
    }
    if (row.metrics.alternatingTransitions < acceptance.minAlternatingTransitions) {
      failedChecks.push(
        `seed ${row.seed}: insufficient peak/trough alternation (${row.metrics.alternatingTransitions} < ${acceptance.minAlternatingTransitions})`,
      );
    }
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
  if (stillTooLongMaxObserved > acceptance.maxStillTooLongCount) {
    failedChecks.push(
      `still-too-long shelter seekers detected (${stillTooLongMaxObserved} > ${acceptance.maxStillTooLongCount})`,
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
}

void main();
