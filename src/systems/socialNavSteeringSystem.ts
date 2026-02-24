import { doorPoseWorld } from '../core/housing/houseFactory';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp } from '../geometry/vector';
import type { System } from './system';

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

function turnTowards(current: number, target: number, maxDelta: number): number {
  const delta = normalizeAngle(target - current);
  return normalizeAngle(current + clamp(delta, -maxDelta, maxDelta));
}

function targetSpeedForIntention(world: World, entityId: number): number {
  const movement = world.movements.get(entityId);
  if (!movement || movement.type !== 'socialNav') {
    return 0;
  }
  if (world.stillness.has(entityId)) {
    return 0;
  }

  const feeling = world.feeling.get(entityId);
  switch (movement.intention) {
    case 'holdStill':
      return 0;
    case 'avoid':
      return movement.maxSpeed * 0.92;
    case 'yield':
      return movement.maxSpeed * 0.45;
    case 'seekShelter':
      return movement.maxSpeed * 0.55;
    case 'approachMate':
      return movement.maxSpeed * 0.66;
    case 'approachForFeeling':
      return Math.max(0.2, Math.min(movement.maxSpeed * 0.62, feeling?.approachSpeed ?? movement.maxSpeed * 0.6));
    case 'roam':
    default:
      return movement.maxSpeed * 0.74;
  }
}

export class SocialNavSteeringSystem implements System {
  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      const movement = world.movements.get(id);
      const transform = world.transforms.get(id);
      if (!movement || movement.type !== 'socialNav' || !transform || world.staticObstacles.has(id)) {
        continue;
      }
      const stillness = world.stillness.get(id);
      if (world.sleep.get(id)?.asleep) {
        continue;
      }
      if (stillness?.mode === 'full') {
        movement.speed = 0;
        movement.smoothSpeed = 0;
        movement.intention = 'holdStill';
        movement.intentionTicksLeft = Math.max(1, stillness.ticksRemaining);
        continue;
      }
      if (stillness) {
        movement.speed = 0;
        movement.smoothSpeed = 0;
        movement.intention = 'holdStill';
        movement.intentionTicksLeft = Math.max(1, stillness.ticksRemaining);
        continue;
      }

      let targetHeading = movement.smoothHeading;
      if (movement.goal?.type === 'direction' && movement.goal.heading !== undefined) {
        targetHeading = movement.goal.heading;
      } else if (movement.goal?.type === 'point') {
        const targetX = movement.goal.x;
        const targetY = movement.goal.y;
        if (targetX !== undefined && targetY !== undefined) {
          targetHeading = Math.atan2(targetY - transform.position.y, targetX - transform.position.x);
        }

        if (
          movement.intention === 'seekShelter' &&
          movement.goal.targetId !== undefined &&
          movement.goal.doorSide !== undefined
        ) {
          const house = world.houses.get(movement.goal.targetId);
          const houseTransform = world.transforms.get(movement.goal.targetId);
          if (house && houseTransform) {
            const doorSpec =
              movement.goal.doorSide === 'east' ? house.doorEast : house.doorWest;
            const door = doorPoseWorld(houseTransform, doorSpec);
            const distanceToDoor = Math.hypot(
              door.midpoint.x - transform.position.x,
              door.midpoint.y - transform.position.y,
            );
            if (distanceToDoor <= Math.max(10, house.doorEnterRadius * 2)) {
              targetHeading = Math.atan2(door.normalInward.y, door.normalInward.x);
            }
          }
        }
      }

      const maxTurnDelta = Math.max(0.1, movement.maxTurnRate) * dt;
      const turnedHeading = turnTowards(movement.smoothHeading, targetHeading, maxTurnDelta);
      const headingAlpha = clamp(dt * 8, 0, 1);
      const speedAlpha = clamp(dt * 6, 0, 1);
      const headingDelta = normalizeAngle(turnedHeading - movement.smoothHeading);
      if (Math.abs(headingDelta) >= 1e-4) {
        movement.smoothHeading = normalizeAngle(
          movement.smoothHeading + headingDelta * headingAlpha,
        );
      }

      const targetSpeed = targetSpeedForIntention(world, id);
      let adjustedTargetSpeed = targetSpeed;
      if (movement.intention === 'seekShelter' && movement.goal?.type === 'point') {
        const targetX = movement.goal.x;
        const targetY = movement.goal.y;
        if (targetX !== undefined && targetY !== undefined) {
          const distanceToTarget = Math.hypot(targetX - transform.position.x, targetY - transform.position.y);
          const arriveScale = clamp(distanceToTarget / 36, 0.08, 1);
          adjustedTargetSpeed *= arriveScale;
        }
      }
      movement.smoothSpeed += (adjustedTargetSpeed - movement.smoothSpeed) * speedAlpha;
      movement.smoothSpeed = clamp(movement.smoothSpeed, 0, movement.maxSpeed);
      if (Math.abs(movement.smoothSpeed) < 0.05) {
        movement.smoothSpeed = 0;
      }

      movement.heading = movement.smoothHeading;
      movement.speed = movement.smoothSpeed;
      movement.turnRate = movement.maxTurnRate;
    }
  }
}
