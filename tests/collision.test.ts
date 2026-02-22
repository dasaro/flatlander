import { describe, expect, it } from 'vitest';

import {
  circleCircleIntersect,
  polygonPolygonIntersectSAT,
  segmentCircleIntersect,
} from '../src/geometry/intersections';

describe('collision primitives', () => {
  it('detects circle-circle overlap correctly', () => {
    const a = { kind: 'circle' as const, center: { x: 0, y: 0 }, radius: 10 };
    const b = { kind: 'circle' as const, center: { x: 15, y: 0 }, radius: 10 };
    const c = { kind: 'circle' as const, center: { x: 30, y: 0 }, radius: 10 };

    expect(circleCircleIntersect(a, b)).toBe(true);
    expect(circleCircleIntersect(a, c)).toBe(false);
  });

  it('detects polygon-polygon overlap with SAT', () => {
    const polyA = {
      kind: 'polygon' as const,
      vertices: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
      ],
    };

    const polyB = {
      kind: 'polygon' as const,
      vertices: [
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 30, y: 30 },
        { x: 10, y: 30 },
      ],
    };

    const polyC = {
      kind: 'polygon' as const,
      vertices: [
        { x: 40, y: 40 },
        { x: 50, y: 40 },
        { x: 50, y: 50 },
        { x: 40, y: 50 },
      ],
    };

    expect(polygonPolygonIntersectSAT(polyA, polyB)).toBe(true);
    expect(polygonPolygonIntersectSAT(polyA, polyC)).toBe(false);
  });

  it('detects segment-circle collision', () => {
    const segment = { kind: 'segment' as const, a: { x: 0, y: 0 }, b: { x: 20, y: 0 } };
    const hitCircle = { kind: 'circle' as const, center: { x: 10, y: 2 }, radius: 3 };
    const missCircle = { kind: 'circle' as const, center: { x: 10, y: 10 }, radius: 3 };

    expect(segmentCircleIntersect(segment, hitCircle)).toBe(true);
    expect(segmentCircleIntersect(segment, missCircle)).toBe(false);
  });
});
