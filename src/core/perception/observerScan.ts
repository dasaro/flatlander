import { geometryFromComponents } from '../entityGeometry';
import { eyePoseWorld } from '../eyePose';
import { isEntityOutside } from '../housing/dwelling';
import { getSortedEntityIds } from '../world';
import type { World } from '../world';
import {
  WORLD_BOUNDARY_HIT_IDS,
  raycastCircle,
  raycastConvexPolygon,
  raycastSegmentCapsule,
  raycastWorldBounds,
} from '../../geometry/raycast';
import { clamp, distance } from '../../geometry/vector';
import type { Vec2 } from '../../geometry/vector';

export type ObserverHitKind = 'entity' | 'boundary';

export interface ObserverScanSample {
  angle: number;
  direction: Vec2;
  hitId: number | null;
  distance: number | null;
  intensity: number;
  kind: ObserverHitKind | null;
  boundarySide?: 'north' | 'south' | 'west' | 'east';
  inanimate: boolean;
}

export interface ObserverScanOptions {
  rays: number;
  fovRad: number;
  lookOffsetRad?: number;
  maxDistance: number;
  fogDensity: number;
  minVisibleIntensity: number;
  includeObstacles: boolean;
  includeBoundaries: boolean;
  inanimateDimMultiplier: number;
  capToEyeFov?: boolean;
}

export interface ObserverScanResult {
  samples: ObserverScanSample[];
  fovRad: number;
  eyeWorld: Vec2;
  forwardWorld: Vec2;
}

interface ScanCandidate {
  id: number;
  geometry: ReturnType<typeof geometryFromComponents>;
  center: Vec2;
  approxRadius: number;
  inanimate: boolean;
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

function collectCandidates(world: World, observerId: number, maxDistance: number, includeObstacles: boolean): ScanCandidate[] {
  const observerTransform = world.transforms.get(observerId);
  if (!observerTransform) {
    return [];
  }

  const ids = getSortedEntityIds(world);
  const candidates: ScanCandidate[] = [];
  for (const id of ids) {
    if (id === observerId) {
      continue;
    }
    const inanimate = world.staticObstacles.has(id);
    if (!includeObstacles && inanimate) {
      continue;
    }
    if (!inanimate && !isEntityOutside(world, id)) {
      continue;
    }

    const shape = world.shapes.get(id);
    const transform = world.transforms.get(id);
    if (!shape || !transform) {
      continue;
    }

    const approxRadius = approxBoundingRadius(world, id);
    if (distance(observerTransform.position, transform.position) > maxDistance + approxRadius) {
      continue;
    }

    candidates.push({
      id,
      geometry: geometryFromComponents(shape, transform),
      center: transform.position,
      approxRadius,
      inanimate,
    });
  }
  return candidates;
}

function raycastCandidate(world: World, origin: Vec2, direction: Vec2, candidate: ScanCandidate): number | null {
  const geometry = candidate.geometry;
  if (geometry.kind === 'circle') {
    return raycastCircle(origin, direction, geometry.center, geometry.radius);
  }
  if (geometry.kind === 'segment') {
    return raycastSegmentCapsule(
      origin,
      direction,
      geometry.a,
      geometry.b,
      Math.max(0, world.config.lineRadius),
    );
  }
  return raycastConvexPolygon(origin, direction, geometry.vertices);
}

function sampleIntensity(
  fogDensity: number,
  distanceToHit: number,
  inanimate: boolean,
  minVisibleIntensity: number,
  inanimateDimMultiplier: number,
): number {
  let intensity = fogDensity <= 0 ? 1 : Math.exp(-Math.max(0, fogDensity) * Math.max(0, distanceToHit));
  if (inanimate) {
    intensity *= Math.max(0, inanimateDimMultiplier);
  }
  if (intensity < Math.max(0, minVisibleIntensity)) {
    return 0;
  }
  return clamp(intensity, 0, 1);
}

export function computeObserverRayScan(
  world: World,
  observerId: number,
  options: ObserverScanOptions,
): ObserverScanResult | null {
  const pose = eyePoseWorld(world, observerId);
  if (!pose) {
    return null;
  }

  const rays = Math.max(3, Math.round(options.rays));
  const requestedFov = Math.max(Math.PI / 12, Math.min(Math.PI * 2, options.fovRad));
  const fovRad = options.capToEyeFov ? Math.min(requestedFov, pose.fovRad) : requestedFov;
  const baseHeading = Math.atan2(pose.forwardWorld.y, pose.forwardWorld.x) + (options.lookOffsetRad ?? 0);
  const maxDistance = Math.max(1, options.maxDistance);
  const includeBoundaries = options.includeBoundaries && world.config.topology === 'bounded';
  const candidates = collectCandidates(world, observerId, maxDistance, options.includeObstacles);

  const samples: ObserverScanSample[] = [];
  for (let i = 0; i < rays; i += 1) {
    const relativeAngle = rays <= 1 ? 0 : -fovRad / 2 + (i / (rays - 1)) * fovRad;
    const absoluteAngle = baseHeading + relativeAngle;
    const direction = {
      x: Math.cos(absoluteAngle),
      y: Math.sin(absoluteAngle),
    };

    let bestDistance = Number.POSITIVE_INFINITY;
    let bestId: number | null = null;
    let bestKind: ObserverHitKind | null = null;
    let bestInanimate = false;
    let bestBoundary: 'north' | 'south' | 'west' | 'east' | undefined;

    for (const candidate of candidates) {
      if (distance(pose.eyeWorld, candidate.center) > maxDistance + candidate.approxRadius) {
        continue;
      }
      const hitDistance = raycastCandidate(world, pose.eyeWorld, direction, candidate);
      if (hitDistance === null || hitDistance < 0 || hitDistance > maxDistance) {
        continue;
      }

      if (
        hitDistance < bestDistance - 1e-9 ||
        (Math.abs(hitDistance - bestDistance) <= 1e-9 && (bestId === null || candidate.id < bestId))
      ) {
        bestDistance = hitDistance;
        bestId = candidate.id;
        bestKind = 'entity';
        bestInanimate = candidate.inanimate;
        bestBoundary = undefined;
      }
    }

    if (includeBoundaries) {
      const boundaryHit = raycastWorldBounds(
        pose.eyeWorld,
        direction,
        world.config.width,
        world.config.height,
      );
      if (boundaryHit && boundaryHit.distance <= maxDistance) {
        const boundaryId = WORLD_BOUNDARY_HIT_IDS[boundaryHit.side];
        if (
          boundaryHit.distance < bestDistance - 1e-9 ||
          (Math.abs(boundaryHit.distance - bestDistance) <= 1e-9 && (bestId === null || boundaryId < bestId))
        ) {
          bestDistance = boundaryHit.distance;
          bestId = boundaryId;
          bestKind = 'boundary';
          bestInanimate = true;
          bestBoundary = boundaryHit.side;
        }
      }
    }

    if (bestId === null || !Number.isFinite(bestDistance) || bestKind === null) {
      samples.push({
        angle: relativeAngle,
        direction,
        hitId: null,
        distance: null,
        intensity: 0,
        kind: null,
        inanimate: false,
      });
      continue;
    }

    const intensity = sampleIntensity(
      options.fogDensity,
      bestDistance,
      bestInanimate,
      options.minVisibleIntensity,
      options.inanimateDimMultiplier,
    );

    if (intensity <= 0) {
      samples.push({
        angle: relativeAngle,
        direction,
        hitId: null,
        distance: null,
        intensity: 0,
        kind: null,
        inanimate: false,
      });
      continue;
    }

    samples.push({
      angle: relativeAngle,
      direction,
      hitId: bestId,
      distance: bestDistance,
      intensity,
      kind: bestKind,
      inanimate: bestInanimate,
      ...(bestBoundary ? { boundarySide: bestBoundary } : {}),
    });
  }

  return {
    samples,
    fovRad,
    eyeWorld: pose.eyeWorld,
    forwardWorld: pose.forwardWorld,
  };
}
