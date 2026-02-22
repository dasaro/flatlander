import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import {
  distancePointToSegment,
  hitTestCircle,
  hitTestPolygon,
  hitTestSegment,
  pointInConvexPolygon,
} from '../src/geometry/picking';
import {
  clientToCanvasPixels,
  cssToleranceToWorldTolerance,
  getCanvasMetrics,
  pickEntityAtWorldPoint,
  shouldTreatPointerAsClick,
} from '../src/ui/pickingController';

describe('picking geometry math', () => {
  it('pointInConvexPolygon works for known polygons', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];

    const hexagon = [
      { x: 0, y: 2 },
      { x: 1.7, y: 1 },
      { x: 1.7, y: -1 },
      { x: 0, y: -2 },
      { x: -1.7, y: -1 },
      { x: -1.7, y: 1 },
    ];

    expect(pointInConvexPolygon({ x: 2, y: 2 }, triangle)).toBe(true);
    expect(pointInConvexPolygon({ x: 8, y: 8 }, triangle)).toBe(false);

    expect(pointInConvexPolygon({ x: 0, y: 0 }, hexagon)).toBe(true);
    expect(pointInConvexPolygon({ x: 3, y: 0 }, hexagon)).toBe(false);
  });

  it('distancePointToSegment computes expected values', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 10, y: 0 };

    expect(distancePointToSegment({ x: 5, y: 3 }, a, b)).toBeCloseTo(3, 8);
    expect(distancePointToSegment({ x: -2, y: 0 }, a, b)).toBeCloseTo(2, 8);
  });

  it('hit tests accept near-edge points using tolerance', () => {
    expect(hitTestCircle({ x: 11, y: 0 }, { x: 0, y: 0 }, 10, 1.5)).toBe(true);
    expect(hitTestSegment({ x: 5, y: 1 }, { x: 0, y: 0 }, { x: 10, y: 0 }, 1.1)).toBe(true);
    expect(
      hitTestPolygon(
        { x: 10.4, y: 5 },
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
          { x: 0, y: 10 },
        ],
        0.5,
      ),
    ).toBe(true);
  });

  it('pickEntityAtWorldPoint resolves deterministic tie-break by smallest id', () => {
    const world = createWorld(1);

    const first = spawnEntity(
      world,
      {
        kind: 'circle',
        size: 20,
      },
      {
        type: 'straightDrift',
        vx: 0,
        vy: 0,
        boundary: 'wrap',
      },
      { x: 100, y: 100 },
    );

    const second = spawnEntity(
      world,
      {
        kind: 'circle',
        size: 20,
      },
      {
        type: 'straightDrift',
        vx: 0,
        vy: 0,
        boundary: 'wrap',
      },
      { x: 100, y: 100 },
    );

    const tiePick = pickEntityAtWorldPoint(world, { x: 100, y: 100 }, 2);
    expect(tiePick).toBe(first);
    expect(second).toBeGreaterThan(first);
  });

  it('gives segments a slightly larger effective hit tolerance', () => {
    const world = createWorld(4);
    const segmentId = spawnEntity(
      world,
      {
        kind: 'segment',
        size: 40,
      },
      {
        type: 'straightDrift',
        vx: 0,
        vy: 0,
        boundary: 'wrap',
      },
      { x: 200, y: 200 },
    );

    const toleranceWorld = 2;
    const picked = pickEntityAtWorldPoint(world, { x: 200, y: 202.4 }, toleranceWorld);
    expect(picked).toBe(segmentId);
  });

  it('converts css-pixel tolerance to world tolerance using scale + zoom', () => {
    const tolWorld = cssToleranceToWorldTolerance(10, 2, 1.5, 4);
    expect(tolWorld).toBeCloseTo(4.375, 8);
  });

  it('maps client coords to canvas pixels using element rect scaling', () => {
    const canvas = {
      width: 1000,
      height: 700,
      getBoundingClientRect: () =>
        ({
          left: 10,
          top: 20,
          width: 500,
          height: 350,
        }) as DOMRect,
    } as unknown as HTMLCanvasElement;

    const metrics = getCanvasMetrics(canvas);
    expect(metrics.scaleX).toBeCloseTo(2, 8);
    expect(metrics.scaleY).toBeCloseTo(2, 8);

    const center = clientToCanvasPixels(metrics, 260, 195);
    expect(center.x).toBeCloseTo(500, 8);
    expect(center.y).toBeCloseTo(350, 8);
  });

  it('treats <=5 css px jitter as click and still selects an entity', () => {
    const world = createWorld(3);
    const entityId = spawnEntity(
      world,
      {
        kind: 'circle',
        size: 14,
      },
      {
        type: 'straightDrift',
        vx: 0,
        vy: 0,
        boundary: 'wrap',
      },
      { x: 100, y: 100 },
    );

    const movedCss = 5;
    const dragThresholdCss = 7;
    expect(shouldTreatPointerAsClick(movedCss, dragThresholdCss)).toBe(true);

    const scaleX = 2;
    const scaleY = 2;
    const zoom = 1;
    const toleranceWorld = cssToleranceToWorldTolerance(10, scaleX, scaleY, zoom);
    const jitterWorld = movedCss * scaleX;
    const picked = pickEntityAtWorldPoint(world, { x: 100 + jitterWorld, y: 100 }, toleranceWorld);
    expect(picked).toBe(entityId);
  });
});
