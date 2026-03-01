import { computeObserverRayScan } from '../core/perception/observerScan';
import type { World } from '../core/world';

export type FlatlanderSample = {
  angle: number;
  hitId: number | null;
  distance: number | null;
  intensity: number;
};

export type FlatlanderSegment = {
  hitId: number;
  startIndex: number;
  endIndex: number;
  minDistanceIndex: number;
};

export type FlatlanderScanResult = {
  samples: FlatlanderSample[];
  segments: FlatlanderSegment[];
  fovRad: number;
};

export type FlatlanderViewConfig = {
  enabled: boolean;
  rays: number;
  fovRad: number;
  lookOffsetRad: number;
  maxDistance: number;
  fogDensity: number;
  minVisibleIntensity: number;
  grayscaleMode: boolean;
  includeObstacles: boolean;
  includeBoundaries: boolean;
  inanimateDimMultiplier: number;
};

function emptyScan(rays: number, fovRad: number): FlatlanderScanResult {
  const count = Math.max(16, Math.round(rays));
  const fov = Math.max(Math.PI / 6, Math.min(Math.PI * 2, fovRad));
  const samples: FlatlanderSample[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = count <= 1 ? 0 : -fov / 2 + (i / (count - 1)) * fov;
    samples.push({
      angle,
      hitId: null,
      distance: null,
      intensity: 0,
    });
  }

  return {
    samples,
    segments: [],
    fovRad: fov,
  };
}

export function extractFlatlanderSegments(samples: FlatlanderSample[]): FlatlanderSegment[] {
  const segments: FlatlanderSegment[] = [];
  let currentHitId: number | null = null;
  let startIndex = -1;

  const flush = (endIndex: number): void => {
    if (currentHitId === null || startIndex < 0 || endIndex < startIndex) {
      currentHitId = null;
      startIndex = -1;
      return;
    }

    let minDistance = Number.POSITIVE_INFINITY;
    let minIndex = startIndex;
    for (let i = startIndex; i <= endIndex; i += 1) {
      const sample = samples[i];
      if (!sample || sample.distance === null) {
        continue;
      }
      if (sample.distance < minDistance) {
        minDistance = sample.distance;
        minIndex = i;
      }
    }

    segments.push({
      hitId: currentHitId,
      startIndex,
      endIndex,
      minDistanceIndex: minIndex,
    });
    currentHitId = null;
    startIndex = -1;
  };

  for (let i = 0; i < samples.length; i += 1) {
    const hitId = samples[i]?.hitId ?? null;
    if (hitId === null) {
      flush(i - 1);
      continue;
    }

    if (currentHitId === null) {
      currentHitId = hitId;
      startIndex = i;
      continue;
    }

    if (hitId !== currentHitId) {
      flush(i - 1);
      currentHitId = hitId;
      startIndex = i;
    }
  }

  flush(samples.length - 1);
  return segments;
}

export function computeFlatlanderScan(
  world: World,
  viewerId: number,
  cfg: FlatlanderViewConfig,
): FlatlanderScanResult {
  const rays = Math.max(16, Math.round(cfg.rays));
  const panelFovRad = Math.max(Math.PI / 6, Math.min(Math.PI * 2, cfg.fovRad));
  const maxDistance = Math.max(1, cfg.maxDistance);

  const scan = computeObserverRayScan(world, viewerId, {
    rays,
    fovRad: panelFovRad,
    lookOffsetRad: cfg.lookOffsetRad,
    maxDistance,
    fogDensity: cfg.fogDensity,
    minVisibleIntensity: cfg.minVisibleIntensity,
    includeObstacles: cfg.includeObstacles,
    includeBoundaries: cfg.includeBoundaries,
    inanimateDimMultiplier: cfg.inanimateDimMultiplier,
    capToEyeFov: true,
  });
  if (!scan) {
    return emptyScan(rays, panelFovRad);
  }

  const samples: FlatlanderSample[] = [];
  for (const sample of scan.samples) {
    samples.push({
      angle: sample.angle,
      hitId: sample.hitId,
      distance: sample.distance,
      intensity: sample.intensity,
    });
  }

  return {
    samples,
    segments: extractFlatlanderSegments(samples),
    fovRad: scan.fovRad,
  };
}
