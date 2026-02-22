import { describe, expect, it } from 'vitest';

import { Rank, RankTag, rankFromShape } from '../src/core/rank';
import type { ShapeComponent } from '../src/core/shapes';
import { regularPolygonVertices } from '../src/geometry/polygon';

const options = {
  irregularityTolerance: 0.08,
  nearCircleThreshold: 15,
};

describe('rankFromShape', () => {
  it('classifies segments as women', () => {
    const shape: ShapeComponent = {
      kind: 'segment',
      length: 10,
      boundingRadius: 5,
    };

    const result = rankFromShape(shape, options);
    expect(result.rank).toBe(Rank.Woman);
  });

  it('classifies circles as priests', () => {
    const shape: ShapeComponent = {
      kind: 'circle',
      radius: 8,
      boundingRadius: 8,
    };

    const result = rankFromShape(shape, options);
    expect(result.rank).toBe(Rank.Priest);
  });

  it('classifies irregular polygons as irregular criminals', () => {
    const shape: ShapeComponent = {
      kind: 'polygon',
      sides: 6,
      vertices: regularPolygonVertices(6, 10),
      irregularity: 0.2,
      regular: false,
      boundingRadius: 10,
    };

    const result = rankFromShape(shape, options);
    expect(result.rank).toBe(Rank.Irregular);
    expect(result.tags).toContain(RankTag.Criminal);
  });

  it('classifies regular triangles as equilateral triangles', () => {
    const shape: ShapeComponent = {
      kind: 'polygon',
      sides: 3,
      vertices: regularPolygonVertices(3, 10),
      irregularity: 0.001,
      regular: true,
      boundingRadius: 10,
      triangleKind: 'Equilateral',
    };

    const result = rankFromShape(shape, options);
    expect(result.rank).toBe(Rank.Triangle);
    expect(result.tags).toContain(RankTag.Equilateral);
  });

  it('classifies isosceles triangles as triangle caste, not irregular', () => {
    const shape: ShapeComponent = {
      kind: 'polygon',
      sides: 3,
      vertices: regularPolygonVertices(3, 10),
      irregularity: 0.35,
      regular: false,
      boundingRadius: 10,
      triangleKind: 'Isosceles',
      isoscelesBaseRatio: 0.05,
    };

    const result = rankFromShape(shape, options);
    expect(result.rank).toBe(Rank.Triangle);
    expect(result.tags).toContain(RankTag.Isosceles);
  });

  it('classifies squares and pentagons as gentlemen', () => {
    const square: ShapeComponent = {
      kind: 'polygon',
      sides: 4,
      vertices: regularPolygonVertices(4, 10),
      irregularity: 0.002,
      regular: true,
      boundingRadius: 10,
    };

    const pentagon: ShapeComponent = {
      kind: 'polygon',
      sides: 5,
      vertices: regularPolygonVertices(5, 10),
      irregularity: 0.002,
      regular: true,
      boundingRadius: 10,
    };

    expect(rankFromShape(square, options).rank).toBe(Rank.Gentleman);
    expect(rankFromShape(pentagon, options).rank).toBe(Rank.Gentleman);
  });

  it('classifies hexagons and above as nobles until near-circle threshold', () => {
    const noble: ShapeComponent = {
      kind: 'polygon',
      sides: 8,
      vertices: regularPolygonVertices(8, 10),
      irregularity: 0.002,
      regular: true,
      boundingRadius: 10,
    };

    const nearCircle: ShapeComponent = {
      kind: 'polygon',
      sides: 18,
      vertices: regularPolygonVertices(18, 10),
      irregularity: 0.002,
      regular: true,
      boundingRadius: 10,
    };

    const nobleRank = rankFromShape(noble, options);
    expect(nobleRank.rank).toBe(Rank.Noble);
    expect(nobleRank.nobleTier).toBe(8);

    expect(rankFromShape(nearCircle, options).rank).toBe(Rank.NearCircle);
  });
});
