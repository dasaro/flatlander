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
  it('disables sight recognition when fogDensity is zero', () => {
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
    expect(world.visionHits.has(viewerId)).toBe(false);
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
    expect(hit?.distance ?? 0).toBeLessThan(120);

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
});
