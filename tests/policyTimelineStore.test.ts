import { describe, expect, it } from 'vitest';

import { PolicyTimelineStore } from '../src/ui/policyTimelineStore';

describe('PolicyTimelineStore', () => {
  it('records only non-normal intervals and preserves phase boundaries deterministically', () => {
    const store = new PolicyTimelineStore();

    store.record(1, 'normal');
    store.record(2, 'agitation');
    store.record(3, 'agitation');
    store.record(4, 'suppression');
    store.record(5, 'suppression');
    store.record(6, 'cooldown');
    store.record(7, 'normal');

    expect(store.getIntervals(7)).toEqual([
      { startTick: 2, endTick: 4, phase: 'agitation' },
      { startTick: 4, endTick: 6, phase: 'suppression' },
      { startTick: 6, endTick: 7, phase: 'cooldown' },
    ]);
    expect(store.phaseAtTick(3, 7)).toBe('agitation');
    expect(store.phaseAtTick(5, 7)).toBe('suppression');
    expect(store.phaseAtTick(7, 7)).toBe('cooldown');
    expect(store.phaseAtTick(8, 8)).toBe('normal');
  });
});
