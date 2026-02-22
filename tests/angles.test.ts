import { describe, expect, it } from 'vitest';

import {
  internalAngles,
  isConvex,
  isSimplePolygon,
  isoscelesTriangleVertices,
  minimumInternalAngle,
  regularPolygonVertices,
} from '../src/geometry/polygon';

const DEG = 180 / Math.PI;

describe('polygon angle calculations', () => {
  it('returns approximately 60 degrees for all regular triangle angles', () => {
    const triangle = regularPolygonVertices(3, 10);
    const angles = internalAngles(triangle).map((angle) => angle * DEG);

    for (const angle of angles) {
      expect(angle).toBeCloseTo(60, 6);
    }
  });

  it('returns approximately 90 degrees for all regular square angles', () => {
    const square = regularPolygonVertices(4, 10);
    const angles = internalAngles(square).map((angle) => angle * DEG);

    for (const angle of angles) {
      expect(angle).toBeCloseTo(90, 6);
    }
  });

  it('minimum internal angle for a regular hexagon is approximately 120 degrees', () => {
    const hexagon = regularPolygonVertices(6, 10);
    const minAngleDegrees = minimumInternalAngle(hexagon) * DEG;
    expect(minAngleDegrees).toBeCloseTo(120, 6);
  });

  it('generates finite, convex, simple isosceles triangles', () => {
    const vertices = isoscelesTriangleVertices(20, 0.05);

    expect(vertices).toHaveLength(3);
    for (const vertex of vertices) {
      expect(Number.isFinite(vertex.x)).toBe(true);
      expect(Number.isFinite(vertex.y)).toBe(true);
    }
    expect(isConvex(vertices)).toBe(true);
    expect(isSimplePolygon(vertices)).toBe(true);
  });
});
