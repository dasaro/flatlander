import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) {
    a -= Math.PI * 2;
  }
  while (a < -Math.PI) {
    a += Math.PI * 2;
  }
  return a;
}

function rotateTowards(current: number, target: number, maxDelta: number): number {
  const delta = normalizeAngle(target - current);
  const clamped = Math.max(-maxDelta, Math.min(maxDelta, delta));
  return normalizeAngle(current + clamped);
}

export class FeelingApproachSystem implements System {
  update(world: World, dt: number): void {
    if (!world.config.feelingEnabledGlobal || world.config.introductionRadius <= 0) {
      return;
    }

    const ids = getSortedEntityIds(world);
    for (const id of ids) {
      if (world.staticObstacles.has(id)) {
        continue;
      }
      if (world.stillness.has(id)) {
        continue;
      }
      if (world.sleep.get(id)?.asleep) {
        continue;
      }

      const movement = world.movements.get(id);
      const transform = world.transforms.get(id);
      const feeling = world.feeling.get(id);
      const knowledge = world.knowledge.get(id);
      if (!movement || !transform || !feeling || !knowledge || !feeling.enabled) {
        continue;
      }
      if (feeling.state !== 'idle' && feeling.state !== 'approaching') {
        continue;
      }

      if (movement.type === 'straightDrift') {
        continue;
      }

      if (movement.type === 'socialNav') {
        continue;
      }

      let nearestId: number | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const otherId of ids) {
        if (otherId === id || world.staticObstacles.has(otherId) || knowledge.known.has(otherId)) {
          continue;
        }

        const otherTransform = world.transforms.get(otherId);
        const otherRank = world.ranks.get(otherId);
        if (!otherTransform || !otherRank) {
          continue;
        }

        const dx = otherTransform.position.x - transform.position.x;
        const dy = otherTransform.position.y - transform.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist > world.config.introductionRadius) {
          continue;
        }

        if (dist < nearestDistance || (dist === nearestDistance && otherId < (nearestId ?? Infinity))) {
          nearestDistance = dist;
          nearestId = otherId;
        }
      }

      if (nearestId === null) {
        if (feeling.state === 'approaching') {
          feeling.state = 'idle';
          feeling.partnerId = null;
          feeling.ticksLeft = 0;
        }
        continue;
      }

      const targetTransform = world.transforms.get(nearestId);
      if (!targetTransform) {
        continue;
      }

      const targetHeading = Math.atan2(
        targetTransform.position.y - transform.position.y,
        targetTransform.position.x - transform.position.x,
      );
      const turnLimit = Math.max(0.1, movement.turnRate * 0.35) * dt;
      movement.heading = rotateTowards(movement.heading, targetHeading, turnLimit);
      movement.speed = Math.max(0.1, Math.min(movement.speed, Math.max(0.1, feeling.approachSpeed)));
      feeling.state = 'approaching';
      feeling.partnerId = nearestId;
      feeling.ticksLeft = 0;
    }
  }
}
