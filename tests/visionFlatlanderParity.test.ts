import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { computeFlatlanderScan } from '../src/render/flatlanderScan';
import { VisionSystem } from '../src/systems/visionSystem';

describe('vision / flatlander scan parity', () => {
  it('uses the same eye/FOV raycast pipeline for front-most hit selection', () => {
    const world = createWorld(1661, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      fogDensity: 0.012,
    });

    const viewerId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 180 },
    );
    const frontId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 190, y: 180 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 6, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 260, y: 180 },
    );

    const transform = world.transforms.get(viewerId);
    const eye = world.eyes.get(viewerId);
    const vision = world.vision.get(viewerId);
    if (!transform || !eye || !vision) {
      throw new Error('Missing viewer components in parity test.');
    }
    transform.rotation = 0;
    eye.fovRad = Math.PI;
    vision.range = 300;

    new VisionSystem().update(world);
    const visionHit = world.visionHits.get(viewerId);
    expect(visionHit?.hitId).toBe(frontId);

    const scan = computeFlatlanderScan(world, viewerId, {
      enabled: true,
      rays: 11,
      fovRad: Math.PI * 2,
      lookOffsetRad: 0,
      maxDistance: 300,
      fogDensity: 0.012,
      minVisibleIntensity: 0,
      grayscaleMode: true,
      includeObstacles: true,
      includeBoundaries: true,
      inanimateDimMultiplier: 0.65,
    });
    const centerSample = scan.samples[Math.floor(scan.samples.length / 2)];
    expect(centerSample?.hitId).toBe(frontId);
  });
});
