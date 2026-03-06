import { expect, it } from 'vitest';

import { createDefaultSimulation } from '../src/presets/defaultSimulation';
import { countPeaksAndTroughs, movingAverage, oscillationAmplitude } from '../src/tools/demographyMetrics';
import { describeLong } from './longTest';

const TOTAL_TICKS = 6_000;
const SAMPLE_EVERY = 100;

describeLong('ecological behavior', () => {
  it(
    'seed 42 shows rain-driven shelter usage and boom-bust dynamics',
    async () => {
      const sim = createDefaultSimulation(42);
      const { world } = sim;
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
      expect(maxPopulation).toBeGreaterThanOrEqual(60);
      expect(minPopulation).toBeLessThanOrEqual(70);
    },
    120_000,
  );
});
