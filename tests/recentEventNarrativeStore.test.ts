import { describe, expect, it } from 'vitest';

import { RecentEventNarrativeStore } from '../src/ui/recentEventNarrativeStore';

describe('recent event narrative store', () => {
  it('stores and ranks notable events deterministically', () => {
    const store = new RecentEventNarrativeStore(20);
    store.ingest([
      { type: 'handshake', tick: 10, aId: 1, bId: 2, pos: { x: 0, y: 0 } },
      { type: 'birth', tick: 11, childId: 4, motherId: 3, pos: { x: 1, y: 1 } },
      { type: 'houseEnter', tick: 12, entityId: 3, houseId: 99, doorSide: 'east', reason: 'RainShelter', pos: { x: 2, y: 2 } },
      { type: 'death', tick: 13, entityId: 2, killerId: 1, pos: { x: 3, y: 3 } },
      {
        type: 'handshakeAttemptFailed',
        tick: 14,
        aId: 1,
        bId: 5,
        pos: { x: 4, y: 4 },
        reason: 'StillnessNotSatisfied',
      },
    ]);

    const entityHighlights = store.getEntityHighlights(1, 15, 3, 10);
    expect(entityHighlights.length).toBeGreaterThan(0);
    expect(entityHighlights[0]?.tick).toBe(14);
    expect(entityHighlights.some((item) => item.text.includes('stillness protocol not satisfied'))).toBe(true);

    const global = store.getGlobalHighlights(15, 3, 10);
    expect(global.length).toBe(3);
    expect(global[0]?.type).toBe('death');
    expect(global.some((item) => item.type === 'birth')).toBe(true);
  });

  it('renders entity labels when a resolver is provided', () => {
    const store = new RecentEventNarrativeStore(10);
    store.ingest([
      { type: 'death', tick: 22, entityId: 9, killerId: 4, pos: { x: 0, y: 0 } },
      {
        type: 'houseEnter',
        tick: 23,
        entityId: 4,
        houseId: 100,
        doorSide: 'west',
        reason: 'RainShelter',
        pos: { x: 1, y: 1 },
      },
    ]);

    const labeled = store.getGlobalHighlights(
      30,
      2,
      20,
      (id) =>
        ({
          4: 'Mr. Alder',
          9: 'Sir Rowan',
          100: 'House #100',
        })[id] ?? null,
    );

    expect(labeled.some((item) => item.text.includes('Sir Rowan'))).toBe(true);
    expect(labeled.some((item) => item.text.includes('Mr. Alder'))).toBe(true);
    expect(labeled.some((item) => item.text.includes('House #100'))).toBe(true);
  });
});
