import { describe, expect, it } from 'vitest';

import { EventAnalytics } from '../src/ui/eventAnalytics';

describe('event analytics', () => {
  it('stores only eventful ticks in sparse summaries', () => {
    const analytics = new EventAnalytics(20);
    analytics.ingest([
      { type: 'touch', tick: 10, aId: 1, bId: 2, pos: { x: 0, y: 0 }, aRankKey: 'Woman:Middle', bRankKey: 'Gentleman' },
      { type: 'death', tick: 12, entityId: 2, pos: { x: 2, y: 2 }, rankKey: 'Gentleman' },
      { type: 'handshake', tick: 12, aId: 1, bId: 3, pos: { x: 1, y: 1 }, aRankKey: 'Woman:Middle', bRankKey: 'Triangle:Equilateral' },
    ]);

    const summaries = analytics.getFilteredSummaries({
      selectedTypes: new Set(['touch', 'death', 'handshake']),
      selectedRankKeys: new Set<string>(),
      splitByRank: false,
      focusEntityId: null,
    });

    expect(summaries.map((summary) => summary.tick)).toEqual([10, 12]);
    expect(summaries[0]?.countsByType.touch).toBe(1);
    expect(summaries[1]?.countsByType.death).toBe(1);
  });

  it('supports focus filtering by selected id', () => {
    const analytics = new EventAnalytics();
    analytics.ingest([
      { type: 'touch', tick: 2, aId: 7, bId: 8, pos: { x: 0, y: 0 } },
      { type: 'stab', tick: 3, attackerId: 7, victimId: 9, pos: { x: 1, y: 1 }, sharpness: 0.6 },
      { type: 'death', tick: 3, entityId: 77, pos: { x: 1.2, y: 1.2 } },
      { type: 'peaceCry', tick: 4, emitterId: 1, pos: { x: 3, y: 3 }, radius: 100 },
    ]);

    const focused = analytics.getFilteredSummaries({
      selectedTypes: new Set(['touch', 'stab', 'death', 'peaceCry']),
      selectedRankKeys: new Set<string>(),
      splitByRank: false,
      focusEntityId: 7,
    });

    expect(focused.map((summary) => summary.tick)).toEqual([2, 3]);
    const tickThreeSummary = focused.find((summary) => summary.tick === 3);
    expect(tickThreeSummary?.countsByType.stab).toBe(1);
    expect(tickThreeSummary?.countsByType.death).toBe(0);
  });

  it('filters by rank keys deterministically', () => {
    const analytics = new EventAnalytics();
    analytics.ingest([
      {
        type: 'death',
        tick: 20,
        entityId: 5,
        pos: { x: 5, y: 5 },
        rankKey: 'Noble',
      },
      {
        type: 'death',
        tick: 20,
        entityId: 6,
        pos: { x: 5, y: 5 },
        rankKey: 'Triangle:Isosceles',
      },
    ]);

    const summaries = analytics.getFilteredSummaries({
      selectedTypes: new Set(['death']),
      selectedRankKeys: new Set(['Triangle:Isosceles']),
      splitByRank: true,
      focusEntityId: null,
    });

    expect(summaries.length).toBe(1);
    expect(summaries[0]?.countsByType.death).toBe(1);
    expect(summaries[0]?.countsByRankKey['Triangle:Isosceles']).toBe(1);
  });
});
