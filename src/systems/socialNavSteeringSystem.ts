import { doorPoseWorld } from '../core/housing/houseFactory';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp, dot, normalize } from '../geometry/vector';
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
    case 'seekHome':
      return movement.maxSpeed * 0.5;
    case 'approachMate':
      return movement.maxSpeed * 0.66;
    case 'approachForFeeling':
      return Math.max(0.2, Math.min(movement.maxSpeed * 0.62, feeling?.approachSpeed ?? movement.maxSpeed * 0.6));
    case 'roam':
    default:
      return movement.maxSpeed * 0.74;
  }
}

function targetHouseContact(
  world: World,
  entityId: number,
  houseId: number,
): { contactPoint: { x: number; y: number }; outwardNormal: { x: number; y: number } } | null {
  for (const manifold of world.manifolds) {
    if (manifold.aId === entityId && manifold.bId === houseId) {
      return {
        contactPoint: manifold.contactPoint,
        outwardNormal: normalize({
          x: -manifold.normal.x,
          y: -manifold.normal.y,
        }),
      };
    }
    if (manifold.aId === houseId && manifold.bId === entityId) {
      return {
        contactPoint: manifold.contactPoint,
        outwardNormal: normalize(manifold.normal),
      };
    }
  }
  return null;
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
      const transit = world.dwellings.get(id)?.transit;
      if (transit?.phase === 'exiting' && transit.ticksLeft > 0) {
        const direction = normalize(transit.dirWorld);
        const heading = Math.atan2(direction.y, direction.x);
        movement.heading = heading;
        movement.smoothHeading = heading;
        movement.speed = Math.max(movement.speed, 10);
        movement.smoothSpeed = Math.max(movement.smoothSpeed, movement.speed);
        movement.intention = 'seekHome';
        movement.intentionTicksLeft = Math.max(movement.intentionTicksLeft, transit.ticksLeft);
        movement.goal = {
          type: 'direction',
          heading,
        };
        transform.rotation = heading;
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
          (movement.intention === 'seekShelter' || movement.intention === 'seekHome') &&
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
            const contact = targetHouseContact(world, id, movement.goal.targetId);
            if (contact) {
              const toDoor = {
                x: door.midpoint.x - contact.contactPoint.x,
                y: door.midpoint.y - contact.contactPoint.y,
              };
              let tangent = {
                x: toDoor.x - contact.outwardNormal.x * dot(toDoor, contact.outwardNormal),
                y: toDoor.y - contact.outwardNormal.y * dot(toDoor, contact.outwardNormal),
              };
              const tangentLength = Math.hypot(tangent.x, tangent.y);
              if (tangentLength <= 1e-4) {
                const sign = ((id ^ movement.goal.targetId) & 1) === 0 ? 1 : -1;
                tangent = {
                  x: -contact.outwardNormal.y * sign,
                  y: contact.outwardNormal.x * sign,
                };
              }
              targetHeading = Math.atan2(tangent.y, tangent.x);
            }
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
      if (
        (movement.intention === 'seekShelter' || movement.intention === 'seekHome') &&
        movement.goal?.type === 'point'
      ) {
        const targetX = movement.goal.x;
        const targetY = movement.goal.y;
        if (targetX !== undefined && targetY !== undefined) {
          const distanceToTarget = Math.hypot(targetX - transform.position.x, targetY - transform.position.y);
          const arriveScale = clamp(distanceToTarget / 36, 0.08, 1);
          adjustedTargetSpeed *= arriveScale;
        }
        if (movement.goal.targetId !== undefined && targetHouseContact(world, id, movement.goal.targetId)) {
          adjustedTargetSpeed = Math.min(adjustedTargetSpeed, movement.maxSpeed * 0.22);
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
