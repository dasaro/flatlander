import { describe, expect, it } from 'vitest';

import {
  countPeaksAndTroughs,
  movingAverage,
  oscillationAmplitude,
  samplePopulation,
} from '../src/tools/demographyMetrics';

describe('demography metrics helpers', () => {
  it('samples deterministic population sizes from a stepper', () => {
    const sim = {
      world: {
        tick: 0,
        entities: new Set<number>([1, 2, 3]),
      },
      stepOneTick() {
        this.world.tick += 1;
        if (this.world.tick === 2) {
          this.world.entities.delete(3);
        }
        if (this.world.tick === 4) {
          this.world.entities.add(4);
        }
      },
    };

    const series = samplePopulation(sim, 5, 1);
    expect(series).toEqual([3, 3, 2, 2, 3, 3]);
  });

  it('detects alternating peaks and troughs on smoothed series', () => {
    const wave = [10, 14, 11, 7, 10, 15, 12, 8, 11, 16, 12, 9, 12];
    const smooth = movingAverage(wave, 3);
    const extrema = countPeaksAndTroughs(smooth);

    expect(extrema.peaks).toBeGreaterThanOrEqual(2);
    expect(extrema.troughs).toBeGreaterThanOrEqual(2);
    expect(extrema.alternatingTransitions).toBeGreaterThanOrEqual(3);
    expect(oscillationAmplitude(smooth)).toBeGreaterThan(0.2);
  });
});
