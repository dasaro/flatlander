import { describe, expect, it } from 'vitest';

import { southAttractionMultiplier } from '../src/core/fields/southAttractionField';

describe('southAttractionMultiplier', () => {
  it('is zero above zone start and near one below zone end', () => {
    const worldHeight = 1000;
    const start = 0.75;
    const end = 0.95;

    expect(southAttractionMultiplier(740, worldHeight, start, end)).toBe(0);
    expect(southAttractionMultiplier(980, worldHeight, start, end)).toBeCloseTo(1, 8);
  });

  it('is monotonic through the transition region', () => {
    const worldHeight = 1000;
    const start = 0.75;
    const end = 0.95;

    const a = southAttractionMultiplier(790, worldHeight, start, end);
    const b = southAttractionMultiplier(840, worldHeight, start, end);
    const c = southAttractionMultiplier(900, worldHeight, start, end);

    expect(a).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(a);
    expect(c).toBeGreaterThanOrEqual(b);
    expect(c).toBeLessThanOrEqual(1);
  });
});
