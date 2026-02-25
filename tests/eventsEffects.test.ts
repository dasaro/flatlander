import { describe, expect, it } from 'vitest';

import { EventQueue, orderedEntityPairs, type WorldEvent } from '../src/core/events';
import { effectFromEvent } from '../src/render/effects';

const origin = { x: 0, y: 0 };

describe('domain event queue', () => {
  it('drain preserves insertion order and clears queue', () => {
    const queue = new EventQueue();
    const events: WorldEvent[] = [
      { type: 'touch', tick: 1, aId: 1, bId: 2, pos: origin },
      { type: 'handshake', tick: 1, aId: 1, bId: 2, pos: origin },
      { type: 'death', tick: 1, entityId: 2, pos: origin },
    ];

    for (const event of events) {
      queue.push(event);
    }

    expect(queue.drain()).toEqual(events);
    expect(queue.drain()).toEqual([]);
  });

  it('orders collision/entity pairs deterministically by ids', () => {
    const ordered = orderedEntityPairs([
      { a: 7, b: 2 },
      { a: 4, b: 1 },
      { a: 2, b: 7 },
      { a: 9, b: 3 },
      { a: 3, b: 9 },
      { a: 2, b: 4 },
    ]);

    expect(ordered).toEqual([
      { a: 1, b: 4 },
      { a: 2, b: 4 },
      { a: 2, b: 7 },
      { a: 3, b: 9 },
    ]);
  });
});

describe('effects mapping', () => {
  it('maps world events to expected effect kinds', () => {
    const events: WorldEvent[] = [
      { type: 'touch', tick: 1, aId: 1, bId: 2, pos: origin },
      { type: 'handshake', tick: 1, aId: 1, bId: 2, pos: origin },
      { type: 'peaceCry', tick: 1, emitterId: 3, pos: origin, radius: 120 },
      { type: 'stab', tick: 1, attackerId: 4, victimId: 5, pos: origin, sharpness: 0.7 },
      { type: 'death', tick: 1, entityId: 5, pos: origin },
      { type: 'birth', tick: 1, childId: 6, motherId: 2, pos: origin },
      {
        type: 'houseEnter',
        tick: 1,
        entityId: 6,
        houseId: 40,
        doorSide: 'west',
        reason: 'RainShelter',
        pos: origin,
      },
      {
        type: 'houseExit',
        tick: 1,
        entityId: 6,
        houseId: 40,
        doorSide: 'west',
        reason: 'Wander',
        pos: origin,
      },
    ];

    const kinds = events
      .map((event) => effectFromEvent(event))
      .filter((effect): effect is NonNullable<typeof effect> => effect !== null)
      .map((effect) => effect.kind);

    expect(kinds).toEqual(['pulse', 'marker', 'ring', 'spark', 'marker', 'pulse', 'marker', 'marker']);
  });

  it('uses X marker only for death events', () => {
    const nonDeathEvents: WorldEvent[] = [
      { type: 'touch', tick: 1, aId: 1, bId: 2, pos: origin },
      { type: 'handshake', tick: 1, aId: 1, bId: 2, pos: origin },
      { type: 'peaceCry', tick: 1, emitterId: 3, pos: origin, radius: 80 },
      { type: 'stab', tick: 1, attackerId: 4, victimId: 5, pos: origin, sharpness: 0.5 },
      { type: 'birth', tick: 1, childId: 6, motherId: 2, pos: origin },
      {
        type: 'houseEnter',
        tick: 1,
        entityId: 6,
        houseId: 40,
        doorSide: 'east',
        reason: 'RainShelter',
        pos: origin,
      },
      {
        type: 'houseExit',
        tick: 1,
        entityId: 6,
        houseId: 40,
        doorSide: 'west',
        reason: 'Wander',
        pos: origin,
      },
      { type: 'regularized', tick: 1, entityId: 8, pos: origin },
    ];

    for (const event of nonDeathEvents) {
      const effect = effectFromEvent(event);
      if (!effect || effect.kind !== 'marker') {
        continue;
      }
      expect(effect.shape).not.toBe('x');
    }

    const deathEffect = effectFromEvent({ type: 'death', tick: 1, entityId: 99, pos: origin });
    expect(deathEffect).not.toBeNull();
    if (!deathEffect || deathEffect.kind !== 'marker') {
      throw new Error('Death event should map to marker effect.');
    }
    expect(deathEffect.shape).toBe('x');
  });
});
