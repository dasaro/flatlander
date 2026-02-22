import { getEyeWorldPosition, getForwardUnitVector } from '../core/eye';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { cross, sub } from '../geometry/vector';
import type { System } from './system';

function normalizeAngle(angle: number): number {
  let next = angle;
  while (next > Math.PI) {
    next -= Math.PI * 2;
  }
  while (next < -Math.PI) {
    next += Math.PI * 2;
  }
  return next;
}

export class AvoidanceSteeringSystem implements System {
  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      const movement = world.movements.get(id);
      const vision = world.vision.get(id);
      const visionHit = world.visionHits.get(id);
      if (!movement || !vision || !vision.enabled || !visionHit) {
        continue;
      }

      if (movement.type === 'straightDrift') {
        continue;
      }

      if (visionHit.distance >= vision.avoidDistance || vision.avoidDistance <= 0) {
        continue;
      }

      const otherTransform = world.transforms.get(visionHit.hitId);
      if (!otherTransform) {
        continue;
      }

      const eye = getEyeWorldPosition(world, id);
      if (!eye) {
        continue;
      }

      const toHit = sub(otherTransform.position, eye);
      const forward = getForwardUnitVector(movement.heading);
      const side = cross(forward, toHit);
      const sideSign = side >= 0 ? 1 : -1;
      const delta = vision.avoidTurnRate * dt;

      movement.heading = normalizeAngle(movement.heading - sideSign * delta);
    }
  }
}
