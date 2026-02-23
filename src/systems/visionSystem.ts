import { getEyeWorldPosition, getForwardUnitVector } from '../core/eye';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { cross, dot, sub } from '../geometry/vector';
import type { System } from './system';

const HAZARD_PADDING = 1.5;

export class VisionSystem implements System {
  update(world: World): void {
    world.visionHits.clear();
    if (!world.config.sightEnabled || world.config.fogDensity <= 0) {
      return;
    }

    const ids = getSortedEntityIds(world);
    const fogDensity = Math.max(0, world.config.fogDensity);
    const fogMinIntensity = Math.max(0, world.config.fogMinIntensity);
    const fogMaxDistance = Math.max(0, world.config.fogMaxDistance);

    for (const id of ids) {
      const vision = world.vision.get(id);
      const perception = world.perceptions.get(id);
      const transform = world.transforms.get(id);
      if (!vision || !perception || !transform || !vision.enabled || vision.range <= 0) {
        continue;
      }

      if (perception.sightSkill <= 0) {
        continue;
      }

      const eye = getEyeWorldPosition(world, id);
      if (!eye) {
        continue;
      }

      const forward = getForwardUnitVector(transform.rotation);

      let bestId: number | null = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (const otherId of ids) {
        if (otherId === id) {
          continue;
        }

        const otherTransform = world.transforms.get(otherId);
        const otherShape = world.shapes.get(otherId);
        if (!otherTransform || !otherShape) {
          continue;
        }

        const toOther = sub(otherTransform.position, eye);
        const aheadDistance = dot(toOther, forward);
        if (aheadDistance <= 0 || aheadDistance > vision.range) {
          continue;
        }
        if (aheadDistance > fogMaxDistance) {
          continue;
        }

        const lateralDistance = Math.abs(cross(forward, toOther));
        const otherRadius = otherShape.boundingRadius;
        if (lateralDistance > otherRadius + HAZARD_PADDING) {
          continue;
        }

        const intensity = Math.exp(-fogDensity * aheadDistance);
        const effective = intensity * perception.sightSkill;
        if (effective < fogMinIntensity) {
          continue;
        }

        if (aheadDistance < bestDistance || (aheadDistance === bestDistance && otherId < (bestId ?? Infinity))) {
          bestDistance = aheadDistance;
          bestId = otherId;
        }
      }

      if (bestId !== null) {
        world.visionHits.set(id, {
          hitId: bestId,
          distance: bestDistance,
        });
      }
    }
  }
}
