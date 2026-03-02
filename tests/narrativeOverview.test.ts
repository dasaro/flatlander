import { describe, expect, it } from 'vitest';

import { buildNarrativeOverview } from '../src/ui/narrativeOverview';
import type { TickSummary } from '../src/ui/eventAnalytics';

function makeSummary(tick: number): TickSummary {
  return {
    tick,
    countsByType: {
      handshakeStart: 0,
      handshakeAttemptFailed: 0,
      touch: 0,
      handshake: 0,
      peaceCry: 0,
      stab: 0,
      death: 0,
      birth: 0,
      houseEnter: 0,
      houseExit: 0,
      regularized: 0,
    },
    countsByRankKey: {},
    byTypeByRankKey: {
      handshakeStart: {},
      handshakeAttemptFailed: {},
      touch: {},
      handshake: {},
      peaceCry: {},
      stab: {},
      death: {},
      birth: {},
      houseEnter: {},
      houseExit: {},
      regularized: {},
    },
    reasonsByType: {
      handshakeStart: {},
      handshakeAttemptFailed: {},
      touch: {},
      handshake: {},
      peaceCry: {},
      stab: {},
      death: {},
      birth: {},
      houseEnter: {},
      houseExit: {},
      regularized: {},
    },
    involvedIds: new Set<number>(),
  };
}

describe('narrative overview', () => {
  it('reports rain shelter phase when most population is sheltering', () => {
    const summary = makeSummary(1200);
    summary.countsByType.houseEnter = 5;
    summary.reasonsByType.houseEnter.RainShelter = 5;

    const overview = buildNarrativeOverview(
      {
        tick: 1200,
        isRaining: true,
        totalPeople: 100,
        outsidePeople: 25,
        insidePeople: 55,
        seekingShelter: 15,
        seekingHome: 10,
        stuckNearHouse: 0,
      },
      [summary],
    );

    expect(overview.headline).toContain('most inhabitants are sheltering');
    expect(overview.bulletinLine).toContain('Gazette:');
    expect(overview.reasons.some((reason) => reason.includes('rain sheltering'))).toBe(true);
  });

  it('surfaces unsuccessful handshake reasons', () => {
    const summary = makeSummary(3400);
    summary.countsByType.handshake = 2;
    summary.countsByType.handshakeAttemptFailed = 4;
    summary.reasonsByType.handshakeAttemptFailed.StillnessNotSatisfied = 3;

    const overview = buildNarrativeOverview(
      {
        tick: 3400,
        isRaining: false,
        totalPeople: 40,
        outsidePeople: 35,
        insidePeople: 5,
        seekingShelter: 0,
        seekingHome: 0,
        stuckNearHouse: 1,
      },
      [summary],
    );

    expect(overview.reasons.some((reason) => reason.includes('stillness protocol was not satisfied'))).toBe(true);
    expect(overview.bulletinLine).toContain('Gazette:');
  });

  it('handles collapsed worlds', () => {
    const overview = buildNarrativeOverview(
      {
        tick: 90,
        isRaining: false,
        totalPeople: 0,
        outsidePeople: 0,
        insidePeople: 0,
        seekingShelter: 0,
        seekingHome: 0,
        stuckNearHouse: 0,
      },
      [],
    );

    expect(overview.headline).toContain('Population collapsed');
    expect(overview.bulletinLine).toContain('city is empty');
    expect(overview.reasons.length).toBeGreaterThan(0);
  });
});
