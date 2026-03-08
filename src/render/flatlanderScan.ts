import { computeObserverRayScan } from '../core/perception/observerScan';
import { sampleVisibleToSight, type SightVisibilityContext } from '../core/perception/sightVisibility';
import type { World } from '../core/world';
import { flatlanderStrokeColorsForHit } from './painting';

export type FlatlanderSample = {
  angle: number;
  hitId: number | null;
  distance: number | null;
  intensity: number;
  paintColor?: string | null;
  strokeColor?: string | null;
  monochromeStrokeColor?: string | null;
  recognition?: 'known' | 'unknown' | 'inanimate' | 'boundary' | null;
  displayLabel?: string | null;
};

export type FlatlanderSegment = {
  hitId: number;
  startIndex: number;
  endIndex: number;
  minDistanceIndex: number;
  recognition: 'known' | 'unknown' | 'inanimate' | 'boundary' | null;
  displayLabel: string | null;
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
      paintColor: null,
      strokeColor: null,
      monochromeStrokeColor: null,
      recognition: null,
      displayLabel: null,
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
      recognition: samples[minIndex]?.recognition ?? samples[startIndex]?.recognition ?? null,
      displayLabel: samples[minIndex]?.displayLabel ?? samples[startIndex]?.displayLabel ?? null,
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
  sightContext?: SightVisibilityContext | null,
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
    const intensity = sightContext ? (sightContext.hasDimnessCue ? sample.intensity : 1) : sample.intensity;
    if (
      sample.hitId !== null &&
      sample.distance !== null &&
      sightContext &&
      !sampleVisibleToSight(intensity, sightContext)
    ) {
      samples.push({
        angle: sample.angle,
        hitId: null,
        distance: null,
        intensity: 0,
        paintColor: null,
        strokeColor: null,
        monochromeStrokeColor: null,
        recognition: null,
        displayLabel: null,
      });
      continue;
    }
    const colors = flatlanderStrokeColorsForHit(world, sample.hitId);
    const recognition = recognitionForHit(world, viewerId, sample.hitId);
    samples.push({
      angle: sample.angle,
      hitId: sample.hitId,
      distance: sample.distance,
      intensity,
      paintColor: colors.paintColor,
      strokeColor: colors.strokeColor,
      monochromeStrokeColor: colors.monochromeStrokeColor,
      recognition: recognition.kind,
      displayLabel: recognition.label,
    });
  }

  return {
    samples,
    segments: extractFlatlanderSegments(samples),
    fovRad: scan.fovRad,
  };
}

function recognitionForHit(
  world: World,
  viewerId: number,
  hitId: number | null,
): { kind: 'known' | 'unknown' | 'inanimate' | 'boundary' | null; label: string | null } {
  if (hitId === null) {
    return { kind: null, label: null };
  }
  if (hitId < 0) {
    return { kind: 'boundary', label: 'Boundary' };
  }
  if (world.houses.has(hitId) || world.staticObstacles.has(hitId)) {
    return { kind: 'inanimate', label: 'House' };
  }

  const knowledge = world.knowledge.get(viewerId);
  const known = viewerId === hitId || knowledge?.known.has(hitId) === true;
  if (known) {
    return {
      kind: 'known',
      label: world.names.get(hitId)?.displayName ?? `#${hitId}`,
    };
  }

  // Part I §5: figures are socially "known" through prior recognition-by-feeling;
  // otherwise the observer sees a person but has not identified them.
  return {
    kind: 'unknown',
    label: 'Unidentified',
  };
}
