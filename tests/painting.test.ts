import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { spawnHouses } from '../src/core/worldgen/houses';
import { Rank } from '../src/core/rank';
import {
  BOUNDARY_STROKE_COLOR,
  flatlanderStrokeColorsForHit,
  HOUSE_STROKE_COLOR,
  monochromeFillForRank,
  monochromeKillStrokeForCount,
  paintedStrokeColorForEntity,
} from '../src/render/painting';
import { deriveOutlineColor } from '../src/render/entityStyle';

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

  it('resolves Flatlander hit colors consistently with visible 2D strokes', () => {
    const world = createWorld(42, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });
    const polygonId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 12, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    const segmentId = spawnEntity(
      world,
      { kind: 'segment', size: 18 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 100 },
    );

    world.config.colorEnabled = true;
    const polygonColors = flatlanderStrokeColorsForHit(world, polygonId);
    const segmentColors = flatlanderStrokeColorsForHit(world, segmentId);
    const polygonRank = world.ranks.get(polygonId);
    if (!polygonRank) {
      throw new Error('Missing rank in painting policy test.');
    }

    expect(polygonColors.strokeColor).toBe(paintedStrokeColorForEntity(world.seed, polygonId, world.shapes.get(polygonId)!));
    expect(polygonColors.monochromeStrokeColor).toBe(
      deriveOutlineColor(monochromeFillForRank(polygonRank.rank)),
    );
    expect(segmentColors.strokeColor).toBe(segmentColors.monochromeStrokeColor);
    expect(segmentColors.strokeColor).toBe(deriveOutlineColor(monochromeFillForRank(Rank.Woman)));
  });

  it('assigns stable inanimate Flatlander hit colors for houses and boundaries', () => {
    const world = createWorld(42, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      housesEnabled: true,
      houseCount: 1,
    });
    spawnHouses(world, world.rng, world.config);
    const houseId = Array.from(world.houses.keys())[0];
    expect(houseId).toBeDefined();
    expect(flatlanderStrokeColorsForHit(world, houseId!).strokeColor).toBe(HOUSE_STROKE_COLOR);
    expect(flatlanderStrokeColorsForHit(world, -4).strokeColor).toBe(BOUNDARY_STROKE_COLOR);
  });
});
