import { describe, expect, it } from 'vitest';

import { Camera } from '../src/render/camera';

describe('camera transforms', () => {
  it('screenToWorld(worldToScreen(p)) round-trips', () => {
    const canvas = { width: 1000, height: 700 };
    const camera = new Camera(1000, 700);
    camera.setZoom(2.4);
    camera.center = { x: 420, y: 260 };

    const point = { x: 137.25, y: 612.75 };
    const screen = camera.worldToScreen(point.x, point.y, canvas);
    const roundTrip = camera.screenToWorld(screen.x, screen.y, canvas);

    expect(roundTrip.x).toBeCloseTo(point.x, 8);
    expect(roundTrip.y).toBeCloseTo(point.y, 8);
  });

  it('zoomAt keeps the world point under cursor fixed', () => {
    const canvas = { width: 1000, height: 700 };
    const camera = new Camera(1000, 700);
    camera.center = { x: 500, y: 350 };

    const cursor = { x: 730, y: 220 };
    const before = camera.screenToWorld(cursor.x, cursor.y, canvas);
    camera.zoomAt(cursor.x, cursor.y, 1.8, canvas);
    const after = camera.screenToWorld(cursor.x, cursor.y, canvas);

    expect(after.x).toBeCloseTo(before.x, 8);
    expect(after.y).toBeCloseTo(before.y, 8);
  });
});
