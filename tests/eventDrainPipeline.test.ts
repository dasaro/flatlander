import { describe, expect, it } from 'vitest';

import type { WorldEvent } from '../src/core/events';
import { EventDrainPipeline } from '../src/ui/eventDrainPipeline';

describe('event drain pipeline', () => {
  it('drains exactly once per tick and fans out to all consumers', () => {
    const emitted: WorldEvent[] = [
      { type: 'touch', tick: 1, aId: 1, bId: 2, pos: { x: 0, y: 0 } },
    ];

    let drainCalls = 0;
    const consumedByFirst: WorldEvent[][] = [];
    const consumedBySecond: WorldEvent[][] = [];

    const pipeline = new EventDrainPipeline(
      0,
      () => {
        drainCalls += 1;
        return emitted;
      },
      [
        (events) => consumedByFirst.push(events),
        (events) => consumedBySecond.push(events),
      ],
    );

    pipeline.processForTick(0);
    pipeline.processForTick(1);
    pipeline.processForTick(1);

    expect(drainCalls).toBe(1);
    expect(consumedByFirst).toHaveLength(1);
    expect(consumedBySecond).toHaveLength(1);
    expect(consumedByFirst[0]).toBe(emitted);
    expect(consumedBySecond[0]).toBe(emitted);
  });

  it('reset updates the internal tick guard', () => {
    let drainCalls = 0;
    const pipeline = new EventDrainPipeline(
      10,
      () => {
        drainCalls += 1;
        return [];
      },
      [() => undefined],
    );

    pipeline.processForTick(10);
    expect(drainCalls).toBe(0);

    pipeline.reset(15);
    pipeline.processForTick(15);
    expect(drainCalls).toBe(0);

    pipeline.processForTick(16);
    expect(drainCalls).toBe(1);
  });
});
