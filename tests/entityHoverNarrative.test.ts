import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { buildEntityHoverNarrative } from '../src/ui/entityHoverNarrative';

describe('entity hover narrative', () => {
  it('describes social-nav behavior with explicit reasons', () => {
    const world = createWorld(9901, { rainEnabled: true, housesEnabled: true });
    world.weather.isRaining = true;

    const entityId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 12,
        maxTurnRate: 1.2,
        decisionEveryTicks: 6,
        intentionMinTicks: 24,
      },
      { x: 120, y: 120 },
    );

    const movement = world.movements.get(entityId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Expected socialNav movement for hover narrative test.');
    }
    movement.intention = 'seekShelter';
    world.visionHits.set(entityId, {
      hitId: 42,
      distance: 28,
      distanceReliable: true,
      intensity: 0.9,
      direction: { x: 1, y: 0 },
      kind: 'entity',
    });
    world.hearingHits.set(entityId, {
      otherId: 9,
      signature: 'WomanCry',
      distance: 20,
      direction: { x: -1, y: 0 },
    });

    const narrative = buildEntityHoverNarrative(
      world,
      entityId,
      'Woman',
      'Woman Segment',
      'Lady Test',
      [{ tick: 120, text: '#1 entered house #3 (rain sheltering).', type: 'houseEnter' }],
    );

    expect(narrative.title).toContain('Lady Test');
    expect(narrative.lines[0]).toContain('heading for shelter');
    expect(narrative.lines.some((line) => line.includes('Why:'))).toBe(true);
    expect(narrative.lines.some((line) => line.includes('Recent:'))).toBe(true);
  });
});
