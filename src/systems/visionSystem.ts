import { getEyeWorldPosition, getForwardUnitVector } from '../core/eye';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { cross, dot, sub } from '../geometry/vector';
import type { System } from './system';

const HAZARD_PADDING = 1.5;

export class VisionSystem implements System {
  update(world: World): void {
    world.visionHits.clear();
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      const vision = world.vision.get(id);
      const transform = world.transforms.get(id);
      if (!vision || !transform || !vision.enabled || vision.range <= 0) {
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

        const lateralDistance = Math.abs(cross(forward, toOther));
        const otherRadius = otherShape.boundingRadius;
        if (lateralDistance > otherRadius + HAZARD_PADDING) {
          continue;
        }

        if (aheadDistance < bestDistance) {
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
