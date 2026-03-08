import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import {
  computeFlatlanderScan,
  extractFlatlanderSegments,
  type FlatlanderSample,
  type FlatlanderViewConfig,
} from '../src/render/flatlanderScan';
import type { SightVisibilityContext } from '../src/core/perception/sightVisibility';
import { flatlanderStrokeColorsForHit } from '../src/render/painting';

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
  it('uses the selected eye FOV and origin (no rear panoramic hits)', () => {
    const world = createWorld(777, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });

    const viewerId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 120 },
    );
    const viewerTransform = world.transforms.get(viewerId);
    const eye = world.eyes.get(viewerId);
    if (!viewerTransform || !eye) {
      throw new Error('Missing viewer setup in eye-origin scan test.');
    }
    viewerTransform.rotation = 0;
    eye.fovRad = Math.PI / 2;

    const frontId = spawnEntity(
      world,
      { kind: 'circle', size: 8 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 145, y: 120 },
    );
    const rearId = spawnEntity(
      world,
      { kind: 'circle', size: 8 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 70, y: 120 },
    );

    const result = computeFlatlanderScan(world, viewerId, {
      ...BASE_SCAN_CONFIG,
      fovRad: Math.PI * 2,
      maxDistance: 300,
      minVisibleIntensity: 0,
    });

    expect(result.fovRad).toBeCloseTo(Math.PI / 2, 8);
    expect(result.samples.some((sample) => sample.hitId === frontId)).toBe(true);
    expect(result.samples.some((sample) => sample.hitId === rearId)).toBe(false);
  });

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

  it('records paint colours only for paintable figures', () => {
    const world = createWorld(444, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });
    const viewerId = spawnEntity(
      world,
      { kind: 'circle', size: 8 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 120 },
    );
    const polygonId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 12, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 150, y: 120 },
    );
    const segmentId = spawnEntity(
      world,
      { kind: 'segment', size: 16 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 170 },
    );

    const result = computeFlatlanderScan(world, viewerId, {
      ...BASE_SCAN_CONFIG,
      maxDistance: 300,
      minVisibleIntensity: 0,
    });

    expect(result.samples.some((sample) => sample.hitId === polygonId && sample.paintColor !== null)).toBe(true);
    expect(result.samples.some((sample) => sample.hitId === segmentId && sample.paintColor !== null)).toBe(false);
  });

  it('records effective stroke colors consistent with the 2D renderer', () => {
    const polygonWorld = createWorld(445, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      colorEnabled: true,
    });
    const polygonViewerId = spawnEntity(
      polygonWorld,
      { kind: 'circle', size: 8 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 120 },
    );
    const polygonViewerTransform = polygonWorld.transforms.get(polygonViewerId);
    if (!polygonViewerTransform) {
      throw new Error('Missing polygon viewer transform in stroke-color scan test.');
    }
    polygonViewerTransform.rotation = 0;
    const polygonId = spawnEntity(
      polygonWorld,
      { kind: 'polygon', sides: 4, size: 12, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 150, y: 120 },
    );
    const polygonResult = computeFlatlanderScan(polygonWorld, polygonViewerId, {
      ...BASE_SCAN_CONFIG,
      maxDistance: 300,
      minVisibleIntensity: 0,
    });
    const polygonSample = polygonResult.samples.find((sample) => sample.hitId === polygonId);
    expect(polygonSample).toBeDefined();
    expect(polygonSample?.strokeColor).toBe(flatlanderStrokeColorsForHit(polygonWorld, polygonId).strokeColor);

    const segmentWorld = createWorld(446, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      colorEnabled: true,
    });
    const segmentViewerId = spawnEntity(
      segmentWorld,
      { kind: 'circle', size: 8 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 120 },
    );
    const segmentViewerTransform = segmentWorld.transforms.get(segmentViewerId);
    if (!segmentViewerTransform) {
      throw new Error('Missing segment viewer transform in stroke-color scan test.');
    }
    segmentViewerTransform.rotation = 0;
    const segmentId = spawnEntity(
      segmentWorld,
      { kind: 'segment', size: 16 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 150, y: 120 },
    );
    const segmentResult = computeFlatlanderScan(segmentWorld, segmentViewerId, {
      ...BASE_SCAN_CONFIG,
      maxDistance: 300,
      minVisibleIntensity: 0,
    });
    const segmentSample = segmentResult.samples.find((sample) => sample.hitId === segmentId);
    expect(segmentSample).toBeDefined();
    expect(segmentSample?.strokeColor).toBe(flatlanderStrokeColorsForHit(segmentWorld, segmentId).strokeColor);
    expect(segmentSample?.monochromeStrokeColor).toBe(
      flatlanderStrokeColorsForHit(segmentWorld, segmentId).monochromeStrokeColor,
    );
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

  it('marks visible people as known or unidentified from the viewer knowledge state', () => {
    const world = createWorld(447, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });
    const viewerId = spawnEntity(
      world,
      { kind: 'circle', size: 8 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 120 },
    );
    const viewerTransform = world.transforms.get(viewerId);
    if (!viewerTransform) {
      throw new Error('Missing viewer transform in recognition scan test.');
    }
    viewerTransform.rotation = 0;

    const knownId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 12, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 150, y: 120 },
    );
    const unknownId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 12, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 160 },
    );
    const knowledge = world.knowledge.get(viewerId);
    const knownRank = world.ranks.get(knownId);
    if (!knowledge || !knownRank) {
      throw new Error('Missing knowledge state in recognition scan test.');
    }
    knowledge.known.set(knownId, {
      rank: knownRank.rank,
      learnedBy: 'feeling',
      learnedAtTick: 10,
    });

    const result = computeFlatlanderScan(world, viewerId, {
      ...BASE_SCAN_CONFIG,
      maxDistance: 300,
      minVisibleIntensity: 0,
    });

    const knownSample = result.samples.find((sample) => sample.hitId === knownId);
    const unknownSample = result.samples.find((sample) => sample.hitId === unknownId);
    expect(knownSample?.recognition).toBe('known');
    expect(knownSample?.displayLabel).toBe(world.names.get(knownId)?.displayName);
    expect(unknownSample?.recognition).toBe('unknown');
    expect(unknownSample?.displayLabel).toBe('Unidentified');
  });

  it('can filter samples with the same sight threshold semantics used by behavior', () => {
    const { world, viewerId, targetId } = setupViewerAndTarget(150);
    const sightContext: SightVisibilityContext = {
      hasDimnessCue: true,
      sightSkill: 0.2,
      fogMinIntensity: 0.3,
    };

    const filtered = computeFlatlanderScan(
      world,
      viewerId,
      {
        ...BASE_SCAN_CONFIG,
        fogDensity: 0.012,
        minVisibleIntensity: 0,
      },
      sightContext,
    );
    expect(filtered.samples.some((sample) => sample.hitId === targetId)).toBe(false);

    const unfiltered = computeFlatlanderScan(world, viewerId, {
      ...BASE_SCAN_CONFIG,
      fogDensity: 0.012,
      minVisibleIntensity: 0,
    });
    expect(unfiltered.samples.some((sample) => sample.hitId === targetId)).toBe(true);
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
      { angle: -1, hitId: null, distance: null, intensity: 0, paintColor: null },
      { angle: -0.5, hitId: 10, distance: 9, intensity: 0.4, paintColor: '#123456' },
      { angle: -0.2, hitId: 10, distance: 4, intensity: 0.7, paintColor: '#123456' },
      { angle: 0.1, hitId: 10, distance: 6, intensity: 0.5, paintColor: '#123456' },
      { angle: 0.4, hitId: null, distance: null, intensity: 0, paintColor: null },
      { angle: 0.8, hitId: 22, distance: 7, intensity: 0.6, paintColor: '#654321' },
    ];

    const segments = extractFlatlanderSegments(samples);
    expect(segments).toEqual([
      {
        hitId: 10,
        startIndex: 1,
        endIndex: 3,
        minDistanceIndex: 2,
        recognition: null,
        displayLabel: null,
      },
      {
        hitId: 22,
        startIndex: 5,
        endIndex: 5,
        minDistanceIndex: 5,
        recognition: null,
        displayLabel: null,
      },
    ]);
  });
});
