import { describe, expect, it } from 'vitest';

import { RainTimelineStore } from '../src/ui/rainTimelineStore';

describe('rain timeline store', () => {
  it('records deterministic rain intervals and active state', () => {
    const store = new RainTimelineStore();

    for (let tick = 0; tick <= 3; tick += 1) {
      store.record(tick, false);
    }
    for (let tick = 4; tick <= 7; tick += 1) {
      store.record(tick, true);
    }
    for (let tick = 8; tick <= 10; tick += 1) {
      store.record(tick, false);
    }

    expect(store.getIntervals(10)).toEqual([{ startTick: 4, endTick: 8 }]);
    expect(store.isRainingAtTick(6, 10)).toBe(true);
    expect(store.isRainingAtTick(9, 10)).toBe(false);
  });

  it('resets history when tick moves backwards', () => {
    const store = new RainTimelineStore();
    store.record(20, true);
    store.record(21, true);
    expect(store.getIntervals(21)).toEqual([{ startTick: 20, endTick: 21 }]);

    store.record(0, false);
    expect(store.getIntervals(0)).toEqual([]);
  });
});
