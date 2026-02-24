import { describe, expect, it } from 'vitest';

import { getVisibleLegendItems, type LegendVisibilityState } from '../src/ui/legendModel';

function baseState(overrides: Partial<LegendVisibilityState> = {}): LegendVisibilityState {
  return {
    eventHighlightsEnabled: true,
    showFeeling: true,
    showHearingOverlay: true,
    showContactNetwork: true,
    showNetworkParents: true,
    showNetworkKnown: true,
    observedEventTypes: new Set(),
    hasSelectedEntity: true,
    hasAnyStillness: false,
    ...overrides,
  };
}

describe('legend model', () => {
  it('shows only items enabled by toggles and observed events', () => {
    const state = baseState({ observedEventTypes: new Set(['death', 'handshake']) });
    const ids = getVisibleLegendItems(state).map((item) => item.id);

    expect(ids).toContain('death');
    expect(ids).toContain('handshake');
    expect(ids).not.toContain('touch');
    expect(ids).toContain('networkParent');
    expect(ids).toContain('networkKnown');
    expect(ids).toContain('hearingLine');
  });

  it('hides hearing and contact network items when corresponding overlays are off', () => {
    const state = baseState({
      showHearingOverlay: false,
      showContactNetwork: false,
      observedEventTypes: new Set(['death']),
    });
    const ids = getVisibleLegendItems(state).map((item) => item.id);

    expect(ids).toContain('death');
    expect(ids).not.toContain('hearingLine');
    expect(ids).not.toContain('networkParent');
    expect(ids).not.toContain('networkKnown');
  });
});
