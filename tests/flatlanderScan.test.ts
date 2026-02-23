import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import {
  computeFlatlanderScan,
  extractFlatlanderSegments,
  type FlatlanderSample,
  type FlatlanderViewConfig,
} from '../src/render/flatlanderScan';

const BASE_SCAN_CONFIG: FlatlanderViewConfig = {
  enabled: true,
  rays: 720,
  fovRad: Math.PI * 2,
  lookOffsetRad: 0,
  maxDistance: 400,
  fogDensity: 0.006,
  minVisibleIntensity: 0.06,
  grayscaleMode: true,
  includeObstacles: true,
  includeBoundaries: true,
  inanimateDimMultiplier: 0.65,
};

function setupViewerAndTarget(targetX: number): { world: ReturnType<typeof createWorld>; viewerId: number; targetId: number } {
  const world = createWorld(321, {
    southAttractionEnabled: false,
    reproductionEnabled: false,
  });

  const viewerId = spawnEntity(
    world,
    { kind: 'circle', size: 8 },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: 100, y: 120 },
  );
  const targetId = spawnEntity(
    world,
    { kind: 'circle', size: 10 },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: targetX, y: 120 },
  );

  const viewerTransform = world.transforms.get(viewerId);
  if (!viewerTransform) {
    throw new Error('Missing viewer transform in flatlander scan test.');
  }
  viewerTransform.rotation = 0;

  return { world, viewerId, targetId };
}

describe('flatlander scan', () => {
  it('returns no hits when maxDistance is too small', () => {
    const { world, viewerId } = setupViewerAndTarget(170);
    const result = computeFlatlanderScan(world, viewerId, {
      ...BASE_SCAN_CONFIG,
      maxDistance: 20,
    });

    expect(result.samples.every((sample) => sample.hitId === null)).toBe(true);
  });

  it('uses intensity=1 for hits when fog density is zero', () => {
    const { world, viewerId, targetId } = setupViewerAndTarget(150);
    const result = computeFlatlanderScan(world, viewerId, {
      ...BASE_SCAN_CONFIG,
      fogDensity: 0,
      maxDistance: 300,
      minVisibleIntensity: 0,
    });

    const hitSample = result.samples.find((sample) => sample.hitId === targetId);
    expect(hitSample).toBeDefined();
    expect(hitSample?.intensity ?? 0).toBeCloseTo(1, 9);
  });

  it('decreases intensity with greater distance when fog is enabled', () => {
    const near = setupViewerAndTarget(145);
    const far = setupViewerAndTarget(240);
    const cfg: FlatlanderViewConfig = {
      ...BASE_SCAN_CONFIG,
      fogDensity: 0.01,
      maxDistance: 500,
      minVisibleIntensity: 0,
    };

    const nearResult = computeFlatlanderScan(near.world, near.viewerId, cfg);
    const farResult = computeFlatlanderScan(far.world, far.viewerId, cfg);

    const nearHit = nearResult.samples.find((sample) => sample.hitId === near.targetId);
    const farHit = farResult.samples.find((sample) => sample.hitId === far.targetId);
    expect(nearHit).toBeDefined();
    expect(farHit).toBeDefined();
    expect(farHit?.intensity ?? 1).toBeLessThan(nearHit?.intensity ?? 0);
  });

  it('shows bounded-world walls as visible lines when enabled', () => {
    const world = createWorld(654, {
      topology: 'bounded',
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });
    const viewerId = spawnEntity(
      world,
      { kind: 'circle', size: 8 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: world.config.width - 50, y: world.config.height / 2 },
    );
    const viewerTransform = world.transforms.get(viewerId);
    if (!viewerTransform) {
      throw new Error('Missing viewer transform in bounded wall scan test.');
    }
    viewerTransform.rotation = 0;

    const scan = computeFlatlanderScan(world, viewerId, {
      ...BASE_SCAN_CONFIG,
      maxDistance: 200,
      fogDensity: 0.012,
      includeBoundaries: true,
      minVisibleIntensity: 0,
    });
    expect(scan.samples.some((sample) => sample.hitId === -4)).toBe(true);
  });
});

describe('flatlander segment extraction', () => {
  it('groups contiguous hit ids and tracks minDistanceIndex', () => {
    const samples: FlatlanderSample[] = [
      { angle: -1, hitId: null, distance: null, intensity: 0 },
      { angle: -0.5, hitId: 10, distance: 9, intensity: 0.4 },
      { angle: -0.2, hitId: 10, distance: 4, intensity: 0.7 },
      { angle: 0.1, hitId: 10, distance: 6, intensity: 0.5 },
      { angle: 0.4, hitId: null, distance: null, intensity: 0 },
      { angle: 0.8, hitId: 22, distance: 7, intensity: 0.6 },
    ];

    const segments = extractFlatlanderSegments(samples);
    expect(segments).toEqual([
      {
        hitId: 10,
        startIndex: 1,
        endIndex: 3,
        minDistanceIndex: 2,
      },
      {
        hitId: 22,
        startIndex: 5,
        endIndex: 5,
        minDistanceIndex: 5,
      },
    ]);
  });
});
