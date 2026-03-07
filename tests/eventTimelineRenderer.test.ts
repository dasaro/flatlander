import { describe, expect, it } from 'vitest';

import { computeTimelineContentLeft } from '../src/render/eventTimelineRenderer';

describe('event timeline label gutter', () => {
  it('expands the left gutter when labels are wider than the minimum', () => {
    const left = computeTimelineContentLeft(
      ['Rain', 'Inspection Death', 'Handshake Failed'],
      (label) => label.length * 7,
    );

    expect(left).toBeGreaterThan(48);
  });

  it('keeps the minimum gutter for short labels', () => {
    const left = computeTimelineContentLeft(['Rain', 'Birth'], () => 10);

    expect(left).toBe(48);
  });
});
