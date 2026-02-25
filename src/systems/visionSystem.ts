import { geometryFromComponents } from '../core/entityGeometry';
import { eyePoseWorld } from '../core/eyePose';
import { isEntityOutside } from '../core/housing/dwelling';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import {
  WORLD_BOUNDARY_HIT_IDS,
  raycastCircle,
  raycastConvexPolygon,
  raycastSegmentCapsule,
  raycastWorldBounds,
} from '../geometry/raycast';
import { clamp, distance, dot, sub } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const DEFAULT_SCAN_RAY_COUNT = 11;
const RAYCAST_EPS = 1e-9;

interface VisionTarget {
  id: number;
  center: Vec2;
  approxRadius: number;
  geometry: ReturnType<typeof geometryFromComponents>;
}

interface VisionCandidate {
  id: number;
  distance: number;
  intensity: number;
  direction: Vec2;
  kind: 'entity' | 'boundary';
  boundarySide?: 'north' | 'south' | 'west' | 'east';
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

function collectTargets(world: World, ids: number[]): VisionTarget[] {
  const targets: VisionTarget[] = [];
  for (const id of ids) {
    if (!isEntityOutside(world, id) && !world.staticObstacles.has(id)) {
      continue;
    }

    const transform = world.transforms.get(id);
    const shape = world.shapes.get(id);
    if (!transform || !shape) {
      continue;
    }

    targets.push({
      id,
      center: transform.position,
      approxRadius: approxBoundingRadius(world, id),
      geometry: geometryFromComponents(shape, transform),
    });
  }

  return targets;
}

function raycastTarget(world: World, eye: Vec2, direction: Vec2, target: VisionTarget): number | null {
  const lineRadius = Math.max(0, world.config.lineRadius);
  const geometry = target.geometry;
  if (geometry.kind === 'circle') {
    return raycastCircle(eye, direction, geometry.center, geometry.radius);
  }

  if (geometry.kind === 'segment') {
    return raycastSegmentCapsule(eye, direction, geometry.a, geometry.b, lineRadius);
  }

  return raycastConvexPolygon(eye, direction, geometry.vertices);
}

function isBetterCandidate(next: VisionCandidate, best: VisionCandidate | null): boolean {
  if (!best) {
    return true;
  }

  if (next.distance < best.distance - RAYCAST_EPS) {
    return true;
  }
  if (Math.abs(next.distance - best.distance) > RAYCAST_EPS) {
    return false;
  }

  if (next.kind !== best.kind) {
    return next.kind === 'entity';
  }

  return next.id < best.id;
}

function targetIntersectsFov(forward: Vec2, toTarget: Vec2, halfFovRad: number, approxRadius: number): boolean {
  if (halfFovRad >= Math.PI - 1e-6) {
    return true;
  }

  const len = Math.hypot(toTarget.x, toTarget.y);
  if (len <= 1e-9) {
    return true;
  }
  const unit = {
    x: toTarget.x / len,
    y: toTarget.y / len,
  };
  const cosine = clamp(dot(unit, forward), -1, 1);
  const centerAngle = Math.acos(cosine);
  if (centerAngle <= halfFovRad + 1e-6) {
    return true;
  }
  if (approxRadius <= 0) {
    return false;
  }
  // Include large targets (e.g. houses) whose center is just outside FOV but whose
  // visible boundary intersects the gaze cone.
  const angularRadius = Math.asin(clamp(approxRadius / len, 0, 1));
  return centerAngle <= halfFovRad + angularRadius + 1e-6;
}

export class VisionSystem implements System {
  update(world: World): void {
    world.visionHits.clear();
    if (!world.config.sightEnabled) {
      return;
    }

    const ids = getSortedEntityIds(world);
    const targets = collectTargets(world, ids);
    const fogDensity = Math.max(0, world.config.fogDensity);
    const hasDimnessCue = fogDensity > 0;
    const fogMinIntensity = Math.max(0, world.config.fogMinIntensity);
    const fogMaxDistance = Math.max(0, world.config.fogMaxDistance);
    const boundedTopology = world.config.topology === 'bounded';

    for (const id of ids) {
      const vision = world.vision.get(id);
      const perception = world.perceptions.get(id);
      if (!vision || !perception || !vision.enabled || vision.range <= 0) {
        continue;
      }
      if (!isEntityOutside(world, id)) {
        continue;
      }

      if (perception.sightSkill <= 0) {
        continue;
      }

      const pose = eyePoseWorld(world, id);
      if (!pose) {
        continue;
      }
      const eye = pose.eyeWorld;
      const forward = pose.forwardWorld;
      const halfFov = clamp(pose.fovRad * 0.5, Math.PI / 12, Math.PI);

      const rayCount = Math.max(3, DEFAULT_SCAN_RAY_COUNT);
      let best: VisionCandidate | null = null;

      for (let rayIndex = 0; rayIndex < rayCount; rayIndex += 1) {
        const t = rayCount <= 1 ? 0 : rayIndex / (rayCount - 1);
        const offset = -halfFov + t * halfFov * 2;
        const angle = Math.atan2(forward.y, forward.x) + offset;
        const rayDirection = {
          x: Math.cos(angle),
          y: Math.sin(angle),
        };

        if (boundedTopology) {
          const boundaryHit = raycastWorldBounds(eye, rayDirection, world.config.width, world.config.height);
          if (boundaryHit && boundaryHit.distance <= vision.range && boundaryHit.distance <= fogMaxDistance) {
            const intensity = hasDimnessCue ? Math.exp(-fogDensity * boundaryHit.distance) : 1;
            const effective = hasDimnessCue ? intensity * perception.sightSkill : perception.sightSkill;
            if (effective >= fogMinIntensity) {
              const candidate: VisionCandidate = {
                id: WORLD_BOUNDARY_HIT_IDS[boundaryHit.side],
                distance: boundaryHit.distance,
                intensity,
                direction: rayDirection,
                kind: 'boundary',
                boundarySide: boundaryHit.side,
              };
              if (isBetterCandidate(candidate, best)) {
                best = candidate;
              }
            }
          }
        }

        for (const target of targets) {
          if (target.id === id) {
            continue;
          }
          if (distance(eye, target.center) > vision.range + target.approxRadius) {
            continue;
          }

          const toTarget = sub(target.center, eye);
          if (!targetIntersectsFov(forward, toTarget, halfFov, target.approxRadius)) {
            continue;
          }
          const aheadDistance = dot(toTarget, rayDirection);
          if (aheadDistance <= 0) {
            continue;
          }

          const hitDistance = raycastTarget(world, eye, rayDirection, target);
          if (hitDistance === null || hitDistance < 0 || hitDistance > vision.range) {
            continue;
          }
          if (hitDistance > fogMaxDistance) {
            continue;
          }

          const intensity = hasDimnessCue ? Math.exp(-fogDensity * hitDistance) : 1;
          const effective = hasDimnessCue ? intensity * perception.sightSkill : perception.sightSkill;
          if (effective < fogMinIntensity) {
            continue;
          }

          const candidate: VisionCandidate = {
            id: target.id,
            distance: hitDistance,
            intensity,
            direction: rayDirection,
            kind: 'entity',
          };
          if (isBetterCandidate(candidate, best)) {
            best = candidate;
          }
        }
      }

      if (best !== null) {
        world.visionHits.set(id, {
          hitId: best.id,
          distance: hasDimnessCue ? best.distance : null,
          distanceReliable: hasDimnessCue,
          intensity: hasDimnessCue ? best.intensity : 1,
          direction: best.direction,
          kind: best.kind,
          ...(best.boundarySide ? { boundarySide: best.boundarySide } : {}),
        });
      }
    }
  }
}
