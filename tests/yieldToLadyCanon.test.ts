import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';

describe('yield-to-lady canon behavior', () => {
  it('emits yield events only for eligible nearby encounters and turns the listener northward', () => {
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
    const movement = world.movements.get(manId);
    if (!cry || !movement || movement.type !== 'socialNav') {
      throw new Error('Missing components in yield-to-lady test.');
    }
    cry.enabled = true;
    cry.cadenceTicks = 1;
    cry.radius = 200;
    cry.lastEmitTick = 0;
    movement.intention = 'roam';
    movement.intentionTicksLeft = 0;

    world.tick = 1;
    new PeaceCrySystem().update(world, 1 / world.config.tickRate);
    new SocialNavMindSystem().update(world);

    const next = world.movements.get(manId);
    if (!next || next.type !== 'socialNav' || !next.goal || next.goal.type !== 'direction') {
      throw new Error('Expected direction goal after yield response.');
    }
    expect(next.intention).toBe('yield');
    expect(Math.sin(next.goal.heading ?? 0)).toBeLessThan(0);

    const yieldEvent = world.events
      .drain()
      .find((event) => event.type === 'yieldToLady' && event.entityId === manId);
    expect(yieldEvent).toBeDefined();
    if (!yieldEvent || yieldEvent.type !== 'yieldToLady') {
      throw new Error('Expected yieldToLady event.');
    }
    expect(yieldEvent.womanId).toBe(womanId);

    world.tick += 1;
    cry.enabled = false;
    movement.intention = 'roam';
    movement.intentionTicksLeft = 0;
    new PeaceCrySystem().update(world, 1 / world.config.tickRate);
    new SocialNavMindSystem().update(world);
    const noYieldEvent = world.events
      .drain()
      .find((event) => event.type === 'yieldToLady' && event.entityId === manId);
    expect(noYieldEvent).toBeUndefined();
  });
});
