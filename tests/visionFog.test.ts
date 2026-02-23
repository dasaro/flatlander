import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { VisionSystem } from '../src/systems/visionSystem';

function setupViewer(worldSeed: number, overrides: Parameters<typeof createWorld>[1] = {}) {
  const world = createWorld(worldSeed, {
    sightEnabled: true,
    fogDensity: 0.006,
    fogMinIntensity: 0.08,
    fogMaxDistance: 450,
    ...overrides,
  });

  const viewerId = spawnEntity(
    world,
    { kind: 'polygon', sides: 5, size: 20, irregular: false },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: 120, y: 120 },
  );
  const viewerTransform = world.transforms.get(viewerId);
  const viewerVision = world.vision.get(viewerId);
  if (!viewerTransform || !viewerVision) {
    throw new Error('Viewer setup failed in fog vision test.');
  }
  viewerTransform.rotation = 0;
  viewerVision.enabled = true;
  viewerVision.range = 320;

  return { world, viewerId };
}

describe('fog-gated sight recognition', () => {
  it('respects per-eye FOV (can see ahead, not behind)', () => {
    const { world, viewerId } = setupViewer(10, {
      fogDensity: 0.006,
      sightEnabled: true,
    });

    const eye = world.eyes.get(viewerId);
    if (!eye) {
      throw new Error('Missing eye component in FOV gating test.');
    }
    eye.fovRad = Math.PI / 2;

    const frontId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 170, y: 120 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 70, y: 120 },
    );

    const system = new VisionSystem();
    system.update(world);
    const hit = world.visionHits.get(viewerId);
    expect(hit?.hitId).toBe(frontId);
  });

  it('keeps presence hits when fogDensity is zero but without dimness-based distance reliability', () => {
    const { world, viewerId } = setupViewer(11, {
      fogDensity: 0,
      sightEnabled: true,
    });
    spawnEntity(
      world,
      { kind: 'polygon', sides: 6, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 120 },
    );

    const system = new VisionSystem();
    system.update(world);
    const hit = world.visionHits.get(viewerId);
    expect(hit?.hitId).toBeDefined();
    expect(hit?.distance).toBeNull();
    expect(hit?.distanceReliable).toBe(false);
    expect(hit?.intensity ?? 0).toBeCloseTo(1, 9);
  });

  it('recognizes nearer targets with fog and ignores targets beyond fogMaxDistance', () => {
    const { world, viewerId } = setupViewer(21, {
      fogDensity: 0.01,
      fogMinIntensity: 0.08,
      fogMaxDistance: 120,
      sightEnabled: true,
    });
    const nearId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 170, y: 120 },
    );
    spawnEntity(
      world,
      { kind: 'circle', size: 10 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 320, y: 120 },
    );

    const system = new VisionSystem();
    system.update(world);
    const hit = world.visionHits.get(viewerId);
    expect(hit?.hitId).toBe(nearId);
    expect(hit?.distance ?? Number.POSITIVE_INFINITY).toBeLessThan(120);
    expect(hit?.distanceReliable).toBe(true);

    const { world: farOnlyWorld, viewerId: farOnlyViewerId } = setupViewer(22, {
      fogDensity: 0.01,
      fogMinIntensity: 0.08,
      fogMaxDistance: 120,
      sightEnabled: true,
    });
    spawnEntity(
      farOnlyWorld,
      { kind: 'polygon', sides: 7, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 320, y: 120 },
    );
    system.update(farOnlyWorld);
    expect(farOnlyWorld.visionHits.has(farOnlyViewerId)).toBe(false);
  });

  it('produces deterministic vision hits for identical seeds and setup', () => {
    const makeHit = () => {
      const { world, viewerId } = setupViewer(77, {
        fogDensity: 0.009,
        fogMaxDistance: 220,
      });
      spawnEntity(
        world,
        { kind: 'polygon', sides: 5, size: 18, irregular: false },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 210, y: 120 },
      );
      const system = new VisionSystem();
      system.update(world);
      return world.visionHits.get(viewerId) ?? null;
    };

    expect(makeHit()).toEqual(makeHit());
  });

  it('detects bounded-world walls as visible hazards', () => {
    const world = createWorld(91, {
      topology: 'bounded',
      sightEnabled: true,
      fogDensity: 0.012,
      fogMinIntensity: 0.08,
      fogMaxDistance: 300,
      southAttractionEnabled: false,
    });
    const viewerId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: world.config.width - 40, y: world.config.height / 2 },
    );
    const viewerTransform = world.transforms.get(viewerId);
    const viewerVision = world.vision.get(viewerId);
    if (!viewerTransform || !viewerVision) {
      throw new Error('Viewer setup failed in bounded-wall vision test.');
    }
    viewerTransform.rotation = 0;
    viewerVision.enabled = true;
    viewerVision.range = 200;

    const system = new VisionSystem();
    system.update(world);
    const hit = world.visionHits.get(viewerId);
    expect(hit?.kind).toBe('boundary');
    expect(hit?.boundarySide).toBe('east');
    expect(hit?.hitId).toBe(-4);
  });
});
