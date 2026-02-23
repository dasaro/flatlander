import { getEyeWorldPosition, getForwardUnitVector } from '../core/eye';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { cross, normalize, sub } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const HEARING_TURN_WEIGHT = 0.75;

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

interface HearingHit {
  otherId: number;
  distance: number;
  direction: Vec2;
}

function nearestAudiblePing(world: World, entityId: number, eye: Vec2): HearingHit | null {
  let best: HearingHit | null = null;

  for (const ping of world.audiblePings) {
    if (ping.emitterId === entityId || ping.radius <= 0 || !world.entities.has(ping.emitterId)) {
      continue;
    }

    const dx = ping.position.x - eye.x;
    const dy = ping.position.y - eye.y;
    const distance = Math.hypot(dx, dy);
    if (distance > ping.radius) {
      continue;
    }

    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && ping.emitterId < best.otherId)
    ) {
      best = {
        otherId: ping.emitterId,
        distance,
        direction: normalize({
          x: dx,
          y: dy,
        }),
      };
    }
  }

  return best;
}

export class AvoidanceSteeringSystem implements System {
  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      const movement = world.movements.get(id);
      if (!movement || world.staticObstacles.has(id)) {
        continue;
      }

      if (movement.type === 'straightDrift') {
        continue;
      }

      if (movement.type === 'socialNav') {
        continue;
      }

      const eye = getEyeWorldPosition(world, id);
      if (!eye) {
        continue;
      }

      const vision = world.vision.get(id);
      const forward = getForwardUnitVector(movement.heading);
      const avoidTurnRate = Math.max(0, vision?.avoidTurnRate ?? world.config.defaultVisionAvoidTurnRate);
      if (avoidTurnRate <= 0) {
        continue;
      }

      let turnDelta = 0;
      let usedSight = false;

      const visionHit = world.visionHits.get(id);
      if (
        vision &&
        vision.enabled &&
        visionHit &&
        vision.avoidDistance > 0 &&
        visionHit.distance < vision.avoidDistance
      ) {
        const otherTransform = world.transforms.get(visionHit.hitId);
        if (otherTransform) {
          const toHit = sub(otherTransform.position, eye);
          const side = cross(forward, toHit);
          const sideSign = side >= 0 ? 1 : -1;
          turnDelta -= sideSign * avoidTurnRate * dt;
          usedSight = true;
        }
      }

      const hearingHit = usedSight
        ? null
        : (world.hearingHits.get(id) ?? nearestAudiblePing(world, id, eye));
      if (hearingHit) {
        const side = cross(forward, hearingHit.direction);
        const sideSign = side >= 0 ? 1 : -1;
        turnDelta -= sideSign * avoidTurnRate * HEARING_TURN_WEIGHT * dt;
      }

      if (turnDelta !== 0) {
        movement.heading = normalizeAngle(movement.heading + turnDelta);
      }
    }
  }
}
