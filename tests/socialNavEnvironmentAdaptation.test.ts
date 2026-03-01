import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
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
});

