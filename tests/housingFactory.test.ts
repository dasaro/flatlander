import { describe, expect, it } from 'vitest';

import { createCanonicalPentagonHouse } from '../src/core/housing/houseFactory';
import { distancePointToSegment } from '../src/geometry/picking';
import { isConvex } from '../src/geometry/polygon';

function isPointOnAnyEdge(vertices: Array<{ x: number; y: number }>, point: { x: number; y: number }): boolean {
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (!a || !b) {
      continue;
    }
    if (distancePointToSegment(point, a, b) <= 1e-6) {
      return true;
    }
  }
  return false;
}

describe('houseFactory canonical pentagon', () => {
  it('generates a convex pentagon with roof apex to the north', () => {
    const layout = createCanonicalPentagonHouse(50, 40);
    expect(layout.verticesLocal).toHaveLength(5);
    expect(isConvex(layout.verticesLocal)).toBe(true);

    const ys = layout.verticesLocal.map((vertex) => vertex.y);
    const minY = Math.min(...ys);
    const apexCount = ys.filter((y) => Math.abs(y - minY) < 1e-6).length;
    expect(apexCount).toBe(1);
  });

  it('places east/west doors on side edges (not roof), with opposite x signs', () => {
    const layout = createCanonicalPentagonHouse(50, 40);
    const apexY = Math.min(...layout.verticesLocal.map((vertex) => vertex.y));

    expect(layout.doorEast.localMidpoint.x).toBeGreaterThan(0);
    expect(layout.doorWest.localMidpoint.x).toBeLessThan(0);
    expect(layout.doorEast.localMidpoint.y).toBeGreaterThan(apexY);
    expect(layout.doorWest.localMidpoint.y).toBeGreaterThan(apexY);
    expect(isPointOnAnyEdge(layout.verticesLocal, layout.doorEast.localMidpoint)).toBe(true);
    expect(isPointOnAnyEdge(layout.verticesLocal, layout.doorWest.localMidpoint)).toBe(true);
  });
});
