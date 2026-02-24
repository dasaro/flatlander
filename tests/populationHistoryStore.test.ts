import { describe, expect, it } from 'vitest';

import {
  PopulationHistoryStore,
  getNearestSliceIndexAtCanvasX,
} from '../src/ui/populationHistoryStore';

describe('population history store', () => {
  it('nearest index helper always snaps to an existing slice', () => {
    expect(getNearestSliceIndexAtCanvasX(10, 100, 0)).toBeNull();
    expect(getNearestSliceIndexAtCanvasX(-10, 100, 5)).toBe(0);
    expect(getNearestSliceIndexAtCanvasX(999, 100, 5)).toBe(4);
    expect(getNearestSliceIndexAtCanvasX(49, 100, 5)).toBeGreaterThanOrEqual(0);
    expect(getNearestSliceIndexAtCanvasX(49, 100, 5)).toBeLessThanOrEqual(4);
  });

  it('ingests only forward ticks and maps canvas x to valid indices', () => {
    const store = new PopulationHistoryStore();
    store.reset(0);
    store.ingest(1, { Woman: 2 });
    store.ingest(4, { Woman: 3, Gentleman: 1 });

    expect(store.slices).toHaveLength(4);
    expect(store.slices[0]?.tick).toBe(1);
    expect(store.slices[3]?.tick).toBe(4);

    const index = store.getNearestSliceIndexAtCanvasX(40, 120);
    expect(index).not.toBeNull();
    expect(index ?? -1).toBeGreaterThanOrEqual(0);
    expect(index ?? -1).toBeLessThan(store.slices.length);
  });
});
