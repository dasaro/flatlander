import { describe, expect, it } from 'vitest';

import { raycastCircle, raycastConvexPolygon } from '../src/geometry/raycast';

describe('raycast primitives', () => {
  it('raycastCircle returns nearest positive distance', () => {
    const origin = { x: 0, y: 0 };
    const dir = { x: 1, y: 0 };
    const center = { x: 10, y: 0 };
    const radius = 2;

    const hit = raycastCircle(origin, dir, center, radius);
    expect(hit).not.toBeNull();
    expect(hit ?? 0).toBeCloseTo(8, 6);
  });

  it('raycastConvexPolygon hits expected side distance', () => {
    const origin = { x: 0, y: 0 };
    const dir = { x: 1, y: 0 };
    const square = [
      { x: 5, y: -1 },
      { x: 7, y: -1 },
      { x: 7, y: 1 },
      { x: 5, y: 1 },
    ];

    const hit = raycastConvexPolygon(origin, dir, square);
    expect(hit).not.toBeNull();
    expect(hit ?? 0).toBeCloseTo(5, 6);
  });
});
