import { describe, expect, it } from 'vitest';

import { Rank } from '../src/core/rank';
import { paintedStrokeColorForEntity, monochromeFillForRank, monochromeKillStrokeForCount } from '../src/render/painting';

describe('painting policy', () => {
  it('keeps women and priests colourless in the ancient painting mode', () => {
    expect(
      paintedStrokeColorForEntity(42, 7, {
        kind: 'segment',
        length: 18,
        boundingRadius: 9,
      }),
    ).toBeNull();
    expect(
      paintedStrokeColorForEntity(42, 8, {
        kind: 'circle',
        radius: 10,
        boundingRadius: 10,
      }),
    ).toBeNull();
  });

  it('assigns deterministic paint colours to ordinary polygons without consuming simulation rng', () => {
    const shape = {
      kind: 'polygon' as const,
      sides: 5,
      vertices: [],
      irregularity: 0,
      regular: true,
      boundingRadius: 12,
    };
    expect(paintedStrokeColorForEntity(42, 11, shape)).toBe(paintedStrokeColorForEntity(42, 11, shape));
    expect(paintedStrokeColorForEntity(42, 11, shape)).not.toBeNull();
    expect(paintedStrokeColorForEntity(42, 11, shape)).not.toBe(paintedStrokeColorForEntity(42, 12, shape));
  });

  it('keeps rank fills and kill styling monochrome by default', () => {
    expect(monochromeFillForRank(Rank.Gentleman)).toMatch(/^#/);
    expect(monochromeKillStrokeForCount(0)).toBe('#3f3a33');
    expect(monochromeKillStrokeForCount(6)).toBe('#1b1712');
  });
});
