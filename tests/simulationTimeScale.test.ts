import { describe, expect, it } from 'vitest';

import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';

describe('FixedTimestepSimulation time scale', () => {
  it('advances approximately twice as many ticks at 2x speed as at 1x', () => {
    const world1x = createWorld(1);
    const sim1x = new FixedTimestepSimulation(world1x, []);
    sim1x.setRunning(true);
    sim1x.frame(1);
    const ticks1x = sim1x.frame(101);

    const world2x = createWorld(1);
    const sim2x = new FixedTimestepSimulation(world2x, []);
    sim2x.setRunning(true);
    sim2x.setTimeScale(2);
    sim2x.frame(1);
    const ticks2x = sim2x.frame(101);

    expect(ticks1x).toBeGreaterThan(0);
    expect(ticks2x).toBeGreaterThan(ticks1x);
    expect(ticks2x / ticks1x).toBeCloseTo(2, 1);
  });
});
