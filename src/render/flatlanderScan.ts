import { geometryFromComponents } from '../core/entityGeometry';
import { eyePoseWorld } from '../core/eyePose';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import {
  WORLD_BOUNDARY_HIT_IDS,
  raycastCircle,
  raycastConvexPolygon,
  raycastSegmentCapsule,
  raycastWorldBounds,
} from '../geometry/raycast';
import { clamp, distance } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';

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

interface ScanCandidate {
  id: number;
  geometry: ReturnType<typeof geometryFromComponents>;
  center: Vec2;
  approxRadius: number;
  inanimate: boolean;
}

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

function approxBoundingRadius(world: World, entityId: number): number {
  const shape = world.shapes.get(entityId);
  if (!shape) {
    return 0;
  }

  if (shape.kind === 'segment') {
    return shape.boundingRadius + Math.max(0, world.config.lineRadius);
  }

  return shape.boundingRadius;
}

function collectCandidates(world: World, viewerId: number, maxDistance: number, includeObstacles: boolean): ScanCandidate[] {
  const viewerTransform = world.transforms.get(viewerId);
  if (!viewerTransform) {
    return [];
  }

  const ids = getSortedEntityIds(world);
  const candidates: ScanCandidate[] = [];
  for (const id of ids) {
    if (id === viewerId) {
      continue;
    }

    const inanimate = world.staticObstacles.has(id);
    if (!includeObstacles && inanimate) {
      continue;
    }

    const shape = world.shapes.get(id);
    const transform = world.transforms.get(id);
    if (!shape || !transform) {
      continue;
    }

    const radius = approxBoundingRadius(world, id);
    if (distance(viewerTransform.position, transform.position) > maxDistance + radius) {
      continue;
    }

    candidates.push({
      id,
      geometry: geometryFromComponents(shape, transform),
      center: transform.position,
      approxRadius: radius,
      inanimate,
    });
  }

  return candidates;
}

function raycastCandidate(world: World, origin: Vec2, dir: Vec2, candidate: ScanCandidate): number | null {
  const lineRadius = Math.max(0, world.config.lineRadius);
  const geometry = candidate.geometry;
  if (geometry.kind === 'circle') {
    return raycastCircle(origin, dir, geometry.center, geometry.radius);
  }

  if (geometry.kind === 'segment') {
    return raycastSegmentCapsule(origin, dir, geometry.a, geometry.b, lineRadius);
  }

  return raycastConvexPolygon(origin, dir, geometry.vertices);
}

function sampleIntensity(
  fogDensity: number,
  distanceToHit: number,
  inanimate: boolean,
  minVisibleIntensity: number,
  inanimateDimMultiplier: number,
): number {
  let intensity =
    fogDensity <= 0 ? 1 : Math.exp(-Math.max(0, fogDensity) * Math.max(0, distanceToHit));

  if (inanimate) {
    intensity *= Math.max(0, inanimateDimMultiplier);
  }

  if (intensity < Math.max(0, minVisibleIntensity)) {
    return 0;
  }

  return clamp(intensity, 0, 1);
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

  const pose = eyePoseWorld(world, viewerId);
  if (!pose) {
    return emptyScan(rays, panelFovRad);
  }

  const fovRad = Math.max(Math.PI / 6, Math.min(panelFovRad, pose.fovRad));
  const eye = pose.eyeWorld;
  const baseHeading = Math.atan2(pose.forwardWorld.y, pose.forwardWorld.x) + cfg.lookOffsetRad;
  const candidates = collectCandidates(world, viewerId, maxDistance, cfg.includeObstacles);

  const samples: FlatlanderSample[] = [];
  for (let i = 0; i < rays; i += 1) {
    const relativeAngle = rays <= 1 ? 0 : -fovRad / 2 + (i / (rays - 1)) * fovRad;
    const absoluteAngle = baseHeading + relativeAngle;
    const dir = {
      x: Math.cos(absoluteAngle),
      y: Math.sin(absoluteAngle),
    };

    let bestDistance = Number.POSITIVE_INFINITY;
    let bestId: number | null = null;
    let bestInanimate = false;

    for (const candidate of candidates) {
      if (distance(eye, candidate.center) > maxDistance + candidate.approxRadius) {
        continue;
      }

      const hitDistance = raycastCandidate(world, eye, dir, candidate);
      if (hitDistance === null || hitDistance < 0 || hitDistance > maxDistance) {
        continue;
      }

      if (
        hitDistance < bestDistance - 1e-9 ||
        (Math.abs(hitDistance - bestDistance) <= 1e-9 && (bestId === null || candidate.id < bestId))
      ) {
        bestDistance = hitDistance;
        bestId = candidate.id;
        bestInanimate = candidate.inanimate;
      }
    }

    if (cfg.includeBoundaries && world.config.topology === 'bounded') {
      const boundaryHit = raycastWorldBounds(eye, dir, world.config.width, world.config.height);
      if (boundaryHit && boundaryHit.distance <= maxDistance) {
        const intensity = sampleIntensity(
          cfg.fogDensity,
          boundaryHit.distance,
          true,
          cfg.minVisibleIntensity,
          cfg.inanimateDimMultiplier,
        );
        if (intensity > 0) {
          const boundaryHitId = WORLD_BOUNDARY_HIT_IDS[boundaryHit.side];
          if (
            boundaryHit.distance < bestDistance - 1e-9 ||
            (Math.abs(boundaryHit.distance - bestDistance) <= 1e-9 &&
              (bestId === null || boundaryHitId < bestId))
          ) {
            bestDistance = boundaryHit.distance;
            bestId = boundaryHitId;
            bestInanimate = true;
          }
        }
      }
    }

    if (bestId === null || !Number.isFinite(bestDistance)) {
      samples.push({
        angle: relativeAngle,
        hitId: null,
        distance: null,
        intensity: 0,
      });
      continue;
    }

    const intensity = sampleIntensity(
      cfg.fogDensity,
      bestDistance,
      bestInanimate,
      cfg.minVisibleIntensity,
      cfg.inanimateDimMultiplier,
    );

    if (intensity <= 0) {
      samples.push({
        angle: relativeAngle,
        hitId: null,
        distance: null,
        intensity: 0,
      });
      continue;
    }

    samples.push({
      angle: relativeAngle,
      hitId: bestId,
      distance: bestDistance,
      intensity,
    });
  }

  return {
    samples,
    segments: extractFlatlanderSegments(samples),
    fovRad,
  };
}
