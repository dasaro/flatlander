import { eyePoseWorld } from '../core/eyePose';
import { fogDensityAt, fogFieldConfigFromWorld } from '../core/fogField';
import { isEntityOutside } from '../core/housing/dwelling';
import { computeObserverRayScan, type ObserverScanSample } from '../core/perception/observerScan';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

const DEFAULT_SCAN_RAY_COUNT = 11;

interface VisionCandidate {
  sample: ObserverScanSample;
}

function isBetterCandidate(next: VisionCandidate, current: VisionCandidate | null): boolean {
  if (current === null) {
    return true;
  }
  const nextDistance = next.sample.distance ?? Number.POSITIVE_INFINITY;
  const currentDistance = current.sample.distance ?? Number.POSITIVE_INFINITY;
  if (nextDistance < currentDistance - 1e-9) {
    return true;
  }
  if (Math.abs(nextDistance - currentDistance) > 1e-9) {
    return false;
  }
  if (next.sample.kind !== current.sample.kind) {
    return next.sample.kind === 'entity';
  }
  return (next.sample.hitId ?? Number.POSITIVE_INFINITY) < (current.sample.hitId ?? Number.POSITIVE_INFINITY);
}

export class VisionSystem implements System {
  update(world: World): void {
    world.visionHits.clear();
    if (!world.config.sightEnabled) {
      return;
    }

    const ids = getSortedEntityIds(world);
    const fogField = fogFieldConfigFromWorld(world);
    const hasDimnessCue = fogField.baseDensity > 0;
    const fogMinIntensity = Math.max(0, world.config.fogMinIntensity);
    const fogMaxDistance = Math.max(0, world.config.fogMaxDistance);

    for (const id of ids) {
      const vision = world.vision.get(id);
      const perception = world.perceptions.get(id);
      if (!vision || !perception || !vision.enabled || vision.range <= 0) {
        continue;
      }
      if (!isEntityOutside(world, id) || perception.sightSkill <= 0) {
        continue;
      }

      const pose = eyePoseWorld(world, id);
      if (!pose) {
        continue;
      }

      const localFogDensity = hasDimnessCue ? fogDensityAt(fogField, pose.eyeWorld) : 0;
      const scan = computeObserverRayScan(world, id, {
        rays: DEFAULT_SCAN_RAY_COUNT,
        fovRad: Math.PI * 2,
        maxDistance: Math.min(Math.max(1, vision.range), fogMaxDistance),
        fogDensity: localFogDensity,
        minVisibleIntensity: 0,
        includeObstacles: true,
        includeBoundaries: true,
        inanimateDimMultiplier: 1,
        capToEyeFov: true,
      });
      if (!scan) {
        continue;
      }

      let best: VisionCandidate | null = null;
      for (const sample of scan.samples) {
        if (sample.hitId === null || sample.kind === null || sample.distance === null) {
          continue;
        }
        if (sample.distance > vision.range || sample.distance > fogMaxDistance) {
          continue;
        }

        const intensity = hasDimnessCue ? sample.intensity : 1;
        const effective = hasDimnessCue ? intensity * perception.sightSkill : perception.sightSkill;
        if (effective < fogMinIntensity) {
          continue;
        }

        const candidate: VisionCandidate = {
          sample,
        };
        if (isBetterCandidate(candidate, best)) {
          best = candidate;
        }
      }

      if (best === null || best.sample.hitId === null) {
        continue;
      }

      world.visionHits.set(id, {
        hitId: best.sample.hitId,
        distance: hasDimnessCue ? best.sample.distance : null,
        distanceReliable: hasDimnessCue,
        intensity: hasDimnessCue ? best.sample.intensity : 1,
        direction: best.sample.direction,
        kind: best.sample.kind === 'boundary' ? 'boundary' : 'entity',
        ...(best.sample.boundarySide ? { boundarySide: best.sample.boundarySide } : {}),
      });
    }
  }
}
