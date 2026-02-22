import { classifyContact } from '../geometry/contactClassifier';
import { angleToVector, clamp } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { World } from '../core/world';
import type { System } from './system';

function relativeSpeed(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function velocityForEntity(world: World, entityId: number): Vec2 {
  const movement = world.movements.get(entityId);
  const southDrift = world.southDrifts.get(entityId)?.vy ?? 0;
  if (!movement) {
    return { x: 0, y: southDrift };
  }

  if (movement.type === 'straightDrift') {
    return {
      x: movement.vx,
      y: movement.vy + southDrift,
    };
  }

  const forward = angleToVector(movement.heading);
  return {
    x: forward.x * movement.speed,
    y: forward.y * movement.speed + southDrift,
  };
}

function lethalityScore(angleRad: number | undefined, speed: number): number {
  if (angleRad === undefined) {
    return 0;
  }

  const sharpness = clamp((Math.PI - angleRad) / Math.PI, 0, 1);
  return sharpness * speed;
}

export class LethalitySystem implements System {
  update(world: World): void {
    for (const collision of world.collisions) {
      if (world.pendingDeaths.has(collision.a) || world.pendingDeaths.has(collision.b)) {
        continue;
      }

      const aShape = world.geometries.get(collision.a);
      const bShape = world.geometries.get(collision.b);
      if (!aShape || !bShape) {
        continue;
      }

      const contact = classifyContact(
        aShape,
        bShape,
        world.config.vertexContactEpsilon,
      );
      if (contact.type === 'touch') {
        continue;
      }

      const speed = relativeSpeed(
        velocityForEntity(world, collision.a),
        velocityForEntity(world, collision.b),
      );
      if (speed < world.config.feelSpeedThreshold) {
        continue;
      }

      const aScore = contact.aHasVertexContact
        ? lethalityScore(contact.aVertexAngleRad, speed)
        : 0;
      const bScore = contact.bHasVertexContact
        ? lethalityScore(contact.bVertexAngleRad, speed)
        : 0;

      if (contact.aHasVertexContact && aScore >= world.config.killThreshold) {
        world.pendingDeaths.add(collision.b);
      }

      if (contact.bHasVertexContact && bScore >= world.config.killThreshold) {
        world.pendingDeaths.add(collision.a);
      }
    }
  }
}
