import { describe, expect, it } from 'vitest';

import {
  normalizedXFromClientX,
  pickFlatlanderSampleAtNormalizedX,
  sampleIndexFromNormalizedX,
} from '../src/render/flatlanderPicking';
import type { FlatlanderSample } from '../src/render/flatlanderScan';

describe('flatlander picking helpers', () => {
  it('maps normalized x to sample indices deterministically', () => {
    expect(sampleIndexFromNormalizedX(0, 5)).toBe(0);
    expect(sampleIndexFromNormalizedX(0.49, 5)).toBe(2);
    expect(sampleIndexFromNormalizedX(1, 5)).toBe(4);
    expect(sampleIndexFromNormalizedX(1.4, 5)).toBe(4);
    expect(sampleIndexFromNormalizedX(-0.2, 5)).toBe(0);
    expect(sampleIndexFromNormalizedX(0.5, 1)).toBe(0);
  });

  it('converts client x to normalized x using css-space rects', () => {
    expect(normalizedXFromClientX(150, 100, 200)).toBeCloseTo(0.25, 9);
    expect(normalizedXFromClientX(50, 100, 200)).toBe(0);
    expect(normalizedXFromClientX(350, 100, 200)).toBe(1);
    expect(normalizedXFromClientX(10, 10, 0)).toBeNull();
  });

  it('picks sample and hit id from normalized x', () => {
    const samples: FlatlanderSample[] = [
      { angle: -1, hitId: 11, distance: 20, intensity: 0.7 },
      { angle: 0, hitId: null, distance: null, intensity: 0 },
      { angle: 1, hitId: 42, distance: 10, intensity: 0.9 },
    ];

    expect(pickFlatlanderSampleAtNormalizedX(samples, 0)).toEqual({
      sampleIndex: 0,
      hitId: 11,
    });
    expect(pickFlatlanderSampleAtNormalizedX(samples, 0.5)).toEqual({
      sampleIndex: 1,
      hitId: null,
    });
    expect(pickFlatlanderSampleAtNormalizedX(samples, 1)).toEqual({
      sampleIndex: 2,
      hitId: 42,
    });
  });
});
