import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';

describe('social-nav environmental adaptation', () => {
  it('biases toward northward avoid intention in the southern danger band', () => {
    const world = createWorld(5510, {
      housesEnabled: false,
      rainEnabled: false,
      southAttractionEnabled: true,
      crowdStressEnabled: false,
      sightEnabled: false,
    });

    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 12,
        maxTurnRate: 1,
        decisionEveryTicks: 4,
        intentionMinTicks: 12,
      },
      { x: 250, y: world.config.height * 0.97 },
    );

    const movement = world.movements.get(womanId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Expected socialNav movement in south-zone adaptation test.');
    }
    movement.intention = 'roam';
    movement.intentionTicksLeft = 0;

    new SocialNavMindSystem().update(world);

    const next = world.movements.get(womanId);
    if (!next || next.type !== 'socialNav' || !next.goal || next.goal.type !== 'direction') {
      throw new Error('Expected a direction goal after south-zone adaptation update.');
    }

    expect(next.intention).toBe('avoid');
    expect(Math.sin(next.goal.heading ?? 0)).toBeLessThan(0);
  });

  it('applies north-side yielding etiquette from nearby woman peace-cry signals', () => {
    const world = createWorld(5511, {
      housesEnabled: false,
      rainEnabled: false,
      northYieldEtiquetteEnabled: true,
      northYieldRadius: 180,
      peaceCryEnabled: true,
    });

    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 8, vy: 0, boundary: 'wrap' },
      { x: 300, y: 280 },
    );
    const manId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 13,
        maxTurnRate: 1.1,
        decisionEveryTicks: 4,
        intentionMinTicks: 16,
      },
      { x: 306, y: 292 },
    );

    const cry = world.peaceCry.get(womanId);
    if (!cry) {
      throw new Error('Woman peace-cry component missing in north-yield test.');
    }
    cry.enabled = true;
    cry.cadenceTicks = 1;
    cry.lastEmitTick = 0;

    const movement = world.movements.get(manId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Man socialNav movement missing in north-yield test.');
    }
    movement.intention = 'roam';
    movement.intentionTicksLeft = 0;

    world.tick = 1;
    const dt = 1 / world.config.tickRate;
    new PeaceCrySystem().update(world, dt);
    new SocialNavMindSystem().update(world);

    const next = world.movements.get(manId);
    if (!next || next.type !== 'socialNav' || !next.goal || next.goal.type !== 'direction') {
      throw new Error('Expected a direction goal after north-yield etiquette update.');
    }

    expect(next.intention).toBe('yield');
    expect(Math.sin(next.goal.heading ?? 0)).toBeLessThan(0);

    const pendingYieldStillness = world.stillnessRequests.find(
      (request) => request.entityId === manId && request.reason === 'yieldToLady',
    );
    expect(pendingYieldStillness).toBeDefined();
    expect(pendingYieldStillness?.requestedBy).toBe(womanId);
  });
});
