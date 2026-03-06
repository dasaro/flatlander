import { expect, it } from 'vitest';

import { createDefaultSimulation } from '../src/presets/defaultSimulation';
import type { World } from '../src/core/world';
import { movingAverage, oscillationAmplitude } from '../src/tools/demographyMetrics';
import { DEMO_SEEDS } from './demographySeeds';
import { describeLong } from './longTest';

const TOTAL_TICKS = 3_000;
const SAMPLE_EVERY = 100;
const LAST_WINDOW_TICKS = 2_000;
const SMOOTH_WINDOW = 5;
const TEST_SEEDS: number[] = [DEMO_SEEDS[0]!, DEMO_SEEDS[1]!, DEMO_SEEDS[4]!];

interface CycleSnapshot {
  minPopulation: number;
  maxPopulation: number;
  diversity: number;
  amplitude: number;
  rareSeen: boolean;
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

async function runCycleProbe(seed: number): Promise<CycleSnapshot> {
  const sim = createDefaultSimulation(seed);
  const { world } = sim;
  const windowSamples = Math.max(1, Math.round(LAST_WINDOW_TICKS / SAMPLE_EVERY));

  const series: number[] = [world.entities.size];
  const categoryHistory: Set<string>[] = [majorCategories(world)];

  for (let tick = 1; tick <= TOTAL_TICKS; tick += 1) {
    sim.stepOneTick();
    if (tick % SAMPLE_EVERY === 0) {
      series.push(world.entities.size);
      categoryHistory.push(majorCategories(world));
    }
    // Keep worker heartbeat alive in long deterministic integration loops.
    if (tick % 250 === 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
  }

  const smoothed = movingAverage(series, SMOOTH_WINDOW);
  const rawWindow = series.slice(-windowSamples);
  const smoothWindow = smoothed.slice(-windowSamples);

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
    rareSeen: union.has('NearCircle') || union.has('Priest'),
  };
}

describeLong('demography cycles (multi-seed)', () => {
  for (const seed of TEST_SEEDS) {
    it(
      `seed ${seed} exhibits bounded cyclic dynamics with rank diversity`,
      async () => {
        const cycle = await runCycleProbe(seed);
        expect(cycle.minPopulation, `seed ${seed} min population`).toBeGreaterThanOrEqual(20);
        expect(cycle.maxPopulation, `seed ${seed} max population`).toBeLessThanOrEqual(650);
        expect(cycle.maxPopulation, `seed ${seed} peak height`).toBeGreaterThanOrEqual(55);
        expect(cycle.diversity, `seed ${seed} rank diversity`).toBeGreaterThanOrEqual(4);
        expect(cycle.amplitude, `seed ${seed} oscillation amplitude`).toBeGreaterThanOrEqual(0.14);
        expect(cycle.rareSeen, `seed ${seed} rare rank reappearance`).toBe(true);
      },
      90_000,
    );
  }
});
