import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { WorldEvent } from '../core/events';
import { Rank } from '../core/rank';
import { createDefaultSimulation } from '../presets/defaultSimulation';
import { RELEASE_PRESET_ID } from '../presets/releasePreset';
import { countPeaksAndTroughs, movingAverage, oscillationAmplitude } from './demographyMetrics';

const DEFAULT_SEEDS = [42, 7, 13, 101];
const DEFAULT_TICKS = 60_000;
const SAMPLE_EVERY_TICKS = 200;
const ANALYSIS_WINDOW_TICKS = 40_000;

interface CanonSample {
  tick: number;
  totalAlive: number;
  insideCount: number;
  rainActive: boolean;
  women: number;
  triangles: number;
  gentlemen: number;
  nobles: number;
  nearCircle: number;
  priests: number;
  irregular: number;
}

interface SeedEventCounts {
  peaceCryComplianceHalt: number;
  yieldToLady: number;
  handshakeAttemptFailed: number;
  handshake: number;
  houseEnter: number;
  houseExit: number;
  inspectionHospitalized: number;
  inspectionExecuted: number;
  death: number;
  birth: number;
  regularized: number;
  policyShift: number;
}

interface FeaturePresence {
  rainObserved: boolean;
  policyObserved: boolean;
  cryComplianceObserved: boolean;
  rainCurfewObserved: boolean;
  yieldObserved: boolean;
  handshakeFailObserved: boolean;
  handshakeObserved: boolean;
  houseEnterObserved: boolean;
  houseExitObserved: boolean;
  inspectionHospitalizedObserved: boolean;
  inspectionDeathObserved: boolean;
  deathObserved: boolean;
  birthObserved: boolean;
  regularizedObserved: boolean;
}

interface SeedSummary {
  seed: number;
  ticks: number;
  samples: CanonSample[];
  events: SeedEventCounts;
  featurePresence: FeaturePresence;
  meanInsideRain: number;
  meanInsideDry: number;
  insideRainVsDryRatio: number;
  rainEnterRatePer1k: number;
  dryEnterRatePer1k: number;
  enterReasons: Record<string, number>;
  exitReasons: Record<string, number>;
  handshakeFailureReasons: Record<string, number>;
  complianceReasons: Record<string, number>;
  housesUsed: number;
  oscillationAmplitude: number;
  peaks: number;
  troughs: number;
  alternatingTransitions: number;
  priestsSeen: boolean;
}

interface CanonAuditReport {
  generatedAt: string;
  preset: string;
  ticks: number;
  sampleEveryTicks: number;
  seeds: number[];
  runs: SeedSummary[];
  acceptance: {
    shelterCorrelationPassingSeeds: number;
    cyclePassingSeeds: number;
    houseUsagePassingSeeds: number;
    allPassed: boolean;
  };
}

function emptyEventCounts(): SeedEventCounts {
  return {
    peaceCryComplianceHalt: 0,
    yieldToLady: 0,
    handshakeAttemptFailed: 0,
    handshake: 0,
    houseEnter: 0,
    houseExit: 0,
    inspectionHospitalized: 0,
    inspectionExecuted: 0,
    death: 0,
    birth: 0,
    regularized: 0,
    policyShift: 0,
  };
}

function summarizeRanks(sim: ReturnType<typeof createDefaultSimulation>): Omit<CanonSample, 'tick' | 'insideCount' | 'rainActive' | 'totalAlive'> {
  let women = 0;
  let triangles = 0;
  let gentlemen = 0;
  let nobles = 0;
  let nearCircle = 0;
  let priests = 0;
  let irregular = 0;

  for (const id of sim.world.entities) {
    const rank = sim.world.ranks.get(id);
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

  return { women, triangles, gentlemen, nobles, nearCircle, priests, irregular };
}

function incrementCounter(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

function applyEvent(
  event: WorldEvent,
  counts: SeedEventCounts,
  featurePresence: FeaturePresence,
  enterReasons: Record<string, number>,
  exitReasons: Record<string, number>,
  handshakeFailureReasons: Record<string, number>,
  complianceReasons: Record<string, number>,
  housesUsed: Set<number>,
): void {
  switch (event.type) {
    case 'peaceCryComplianceHalt':
      counts.peaceCryComplianceHalt += 1;
      featurePresence.cryComplianceObserved = true;
      if (event.reason === 'RainCurfew') {
        featurePresence.rainCurfewObserved = true;
      }
      incrementCounter(complianceReasons, event.reason);
      break;
    case 'yieldToLady':
      counts.yieldToLady += 1;
      featurePresence.yieldObserved = true;
      break;
    case 'handshakeAttemptFailed':
      counts.handshakeAttemptFailed += 1;
      featurePresence.handshakeFailObserved = true;
      incrementCounter(handshakeFailureReasons, event.reason);
      break;
    case 'handshake':
      counts.handshake += 1;
      featurePresence.handshakeObserved = true;
      break;
    case 'houseEnter':
      counts.houseEnter += 1;
      featurePresence.houseEnterObserved = true;
      incrementCounter(enterReasons, event.reason);
      housesUsed.add(event.houseId);
      break;
    case 'houseExit':
      counts.houseExit += 1;
      featurePresence.houseExitObserved = true;
      incrementCounter(exitReasons, event.reason);
      housesUsed.add(event.houseId);
      break;
    case 'inspectionHospitalized':
      counts.inspectionHospitalized += 1;
      featurePresence.inspectionHospitalizedObserved = true;
      break;
    case 'inspectionExecuted':
      counts.inspectionExecuted += 1;
      featurePresence.inspectionDeathObserved = true;
      break;
    case 'death':
      counts.death += 1;
      featurePresence.deathObserved = true;
      break;
    case 'birth':
      counts.birth += 1;
      featurePresence.birthObserved = true;
      break;
    case 'regularized':
      counts.regularized += 1;
      featurePresence.regularizedObserved = true;
      break;
    case 'policyShift':
      counts.policyShift += 1;
      featurePresence.policyObserved = true;
      break;
    default:
      break;
  }
}

function runSeed(seed: number, ticks: number): SeedSummary {
  const simulation = createDefaultSimulation(seed);
  const { world } = simulation;
  const counts = emptyEventCounts();
  const featurePresence: FeaturePresence = {
    rainObserved: false,
    policyObserved: false,
    cryComplianceObserved: false,
    rainCurfewObserved: false,
    yieldObserved: false,
    handshakeFailObserved: false,
    handshakeObserved: false,
    houseEnterObserved: false,
    houseExitObserved: false,
    inspectionHospitalizedObserved: false,
    inspectionDeathObserved: false,
    deathObserved: false,
    birthObserved: false,
    regularizedObserved: false,
  };
  const enterReasons: Record<string, number> = {};
  const exitReasons: Record<string, number> = {};
  const handshakeFailureReasons: Record<string, number> = {};
  const complianceReasons: Record<string, number> = {};
  const housesUsed = new Set<number>();
  const samples: CanonSample[] = [];

  let rainInsideSum = 0;
  let rainSamples = 0;
  let dryInsideSum = 0;
  let drySamples = 0;
  let rainTicks = 0;
  let dryTicks = 0;
  let rainEnterCount = 0;
  let dryEnterCount = 0;

  for (let tick = 0; tick < ticks; tick += 1) {
    simulation.stepOneTick();
    const insideCount = simulation.world.insideCountThisTick;

    if (world.weather.isRaining) {
      featurePresence.rainObserved = true;
      rainInsideSum += insideCount;
      rainSamples += 1;
      rainTicks += 1;
    } else {
      dryInsideSum += insideCount;
      drySamples += 1;
      dryTicks += 1;
    }

    const events = world.events.drain();
    for (const event of events) {
      if (event.type === 'houseEnter') {
        if (world.weather.isRaining) {
          rainEnterCount += 1;
        } else {
          dryEnterCount += 1;
        }
      }
      applyEvent(
        event,
        counts,
        featurePresence,
        enterReasons,
        exitReasons,
        handshakeFailureReasons,
        complianceReasons,
        housesUsed,
      );
    }

    if (world.tick % SAMPLE_EVERY_TICKS === 0) {
      const ranks = summarizeRanks(simulation);
      samples.push({
        tick: world.tick,
        totalAlive: world.entities.size,
        insideCount,
        rainActive: world.weather.isRaining,
        ...ranks,
      });
    }
  }

  const latestTick = samples[samples.length - 1]?.tick ?? world.tick;
  const windowStart = Math.max(0, latestTick - ANALYSIS_WINDOW_TICKS);
  const analysisSamples = samples.filter((sample) => sample.tick >= windowStart);
  const totals = analysisSamples.map((sample) => sample.totalAlive);
  const smoothed = movingAverage(totals, 9);
  const extrema = countPeaksAndTroughs(smoothed);

  return {
    seed,
    ticks,
    samples,
    events: counts,
    featurePresence,
    meanInsideRain: rainSamples > 0 ? rainInsideSum / rainSamples : 0,
    meanInsideDry: drySamples > 0 ? dryInsideSum / drySamples : 0,
    insideRainVsDryRatio:
      drySamples > 0 && dryInsideSum > 0 ? (rainInsideSum / rainSamples) / (dryInsideSum / drySamples) : rainSamples > 0 ? Infinity : 0,
    rainEnterRatePer1k: rainTicks > 0 ? (rainEnterCount * 1000) / rainTicks : 0,
    dryEnterRatePer1k: dryTicks > 0 ? (dryEnterCount * 1000) / dryTicks : 0,
    enterReasons,
    exitReasons,
    handshakeFailureReasons,
    complianceReasons,
    housesUsed: housesUsed.size,
    oscillationAmplitude: oscillationAmplitude(smoothed),
    peaks: extrema.peaks,
    troughs: extrema.troughs,
    alternatingTransitions: extrema.alternatingTransitions,
    priestsSeen: samples.some((sample) => sample.priests > 0 || sample.nearCircle > 0),
  };
}

function main(): void {
  const ticksArg = Number(process.argv[2] ?? DEFAULT_TICKS);
  const ticks = Number.isFinite(ticksArg) && ticksArg > 0 ? Math.round(ticksArg) : DEFAULT_TICKS;
  const runs: SeedSummary[] = [];
  for (const seed of DEFAULT_SEEDS) {
    const run = runSeed(seed, ticks);
    runs.push(run);
    console.log(
      `completed seed=${run.seed} rainRatio=${Number.isFinite(run.insideRainVsDryRatio) ? run.insideRainVsDryRatio.toFixed(2) : 'inf'} amp=${run.oscillationAmplitude.toFixed(3)} enters=${run.events.houseEnter} exits=${run.events.houseExit}`,
    );
  }
  const shelterCorrelationPassingSeeds = runs.filter(
    (run) => run.insideRainVsDryRatio > 1.5 && run.rainEnterRatePer1k > run.dryEnterRatePer1k,
  ).length;
  const cyclePassingSeeds = runs.filter(
    (run) =>
      run.oscillationAmplitude >= 0.1 &&
      run.peaks >= 2 &&
      run.troughs >= 2 &&
      run.alternatingTransitions >= 4,
  ).length;
  const houseUsagePassingSeeds = runs.filter(
    (run) => run.events.houseEnter >= 20 && run.events.houseExit >= 20 && run.housesUsed >= 3,
  ).length;
  const report: CanonAuditReport = {
    generatedAt: new Date().toISOString(),
    preset: RELEASE_PRESET_ID,
    ticks,
    sampleEveryTicks: SAMPLE_EVERY_TICKS,
    seeds: DEFAULT_SEEDS,
    runs,
    acceptance: {
      shelterCorrelationPassingSeeds,
      cyclePassingSeeds,
      houseUsagePassingSeeds,
      allPassed:
        shelterCorrelationPassingSeeds >= 3 &&
        cyclePassingSeeds >= 3 &&
        houseUsagePassingSeeds >= 3,
    },
  };

  const artifactDir = join(process.cwd(), '.artifacts');
  mkdirSync(artifactDir, { recursive: true });
  const artifactPath = join(artifactDir, 'canon_audit.json');
  writeFileSync(artifactPath, JSON.stringify(report, null, 2));

  console.log(`preset=${RELEASE_PRESET_ID}`);
  console.log(`ticks=${ticks}`);
  for (const run of runs) {
    console.log(
      [
        `seed=${run.seed}`,
        `rainRatio=${Number.isFinite(run.insideRainVsDryRatio) ? run.insideRainVsDryRatio.toFixed(2) : 'inf'}`,
        `enterRateRain=${run.rainEnterRatePer1k.toFixed(2)}`,
        `enterRateDry=${run.dryEnterRatePer1k.toFixed(2)}`,
        `houseEnter=${run.events.houseEnter}`,
        `houseExit=${run.events.houseExit}`,
        `housesUsed=${run.housesUsed}`,
        `amp=${run.oscillationAmplitude.toFixed(3)}`,
        `peaks=${run.peaks}`,
        `troughs=${run.troughs}`,
        `alt=${run.alternatingTransitions}`,
        `policy=${run.events.policyShift}`,
        `yield=${run.events.yieldToLady}`,
        `cryHalts=${run.events.peaceCryComplianceHalt}`,
        `handshake=${run.events.handshake}`,
        `handshakeFail=${run.events.handshakeAttemptFailed}`,
        `hospitalized=${run.events.inspectionHospitalized}`,
        `inspectionDeath=${run.events.inspectionExecuted}`,
        `birth=${run.events.birth}`,
        `death=${run.events.death}`,
        `regularized=${run.events.regularized}`,
      ].join(' '),
    );
    console.log(
      `  enterReasons=${JSON.stringify(run.enterReasons)} exitReasons=${JSON.stringify(run.exitReasons)} failureReasons=${JSON.stringify(run.handshakeFailureReasons)} complianceReasons=${JSON.stringify(run.complianceReasons)}`,
    );
  }
  console.log(
    `acceptance shelter=${report.acceptance.shelterCorrelationPassingSeeds}/${runs.length} cycles=${report.acceptance.cyclePassingSeeds}/${runs.length} houseUsage=${report.acceptance.houseUsagePassingSeeds}/${runs.length}`,
  );
  console.log(`artifact=${artifactPath}`);

  if (!report.acceptance.allPassed) {
    console.log('FAIL: canon audit thresholds not met.');
    process.exit(1);
  }
  console.log('PASS: canon audit thresholds met.');
  process.exit(0);
}

main();
