import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';

describe('houses are disabled', () => {
  it('defaults to no house spawning config', () => {
    const world = createWorld(101);
    expect(world.config.housesEnabled).toBe(false);
    expect(world.config.houseCount).toBe(0);
    expect(world.houses.size).toBe(0);
    expect(world.staticObstacles.size).toBe(0);
  });

  it('normal entity spawns do not create static houses', () => {
    const world = createWorld(102);
    spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 14, maxTurnRate: 1.2, decisionEveryTicks: 18, intentionMinTicks: 80 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 20, irregular: false },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 12, maxTurnRate: 1, decisionEveryTicks: 20, intentionMinTicks: 90 },
    );

    expect(world.houses.size).toBe(0);
    expect(world.staticObstacles.size).toBe(0);
  });
});
