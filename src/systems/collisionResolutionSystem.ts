import type { MovementComponent, TransformComponent } from '../core/components';
import type { EntityId } from '../core/components';
import type { World } from '../core/world';
import { EPSILON, clamp, dot, length, mul, sub, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

function removeIntoNormal(velocity: Vec2, normal: Vec2): Vec2 {
  const component = dot(velocity, normal);
  if (component <= 0) {
    return velocity;
  }
  return sub(velocity, mul(normal, component));
}

function movementVelocity(movement: MovementComponent): Vec2 {
  if (movement.type === 'straightDrift') {
    return {
      x: movement.vx,
      y: movement.vy,
    };
  }

  return {
    x: Math.cos(movement.heading) * movement.speed,
    y: Math.sin(movement.heading) * movement.speed,
  };
}

function applyVelocity(movement: MovementComponent, transform: TransformComponent, velocity: Vec2): void {
  if (movement.type === 'straightDrift') {
    movement.vx = velocity.x;
    movement.vy = velocity.y;
    transform.rotation = Math.atan2(velocity.y, velocity.x);
    return;
  }

  const nextSpeed = length(velocity);
  movement.speed = Math.max(0, nextSpeed);
  if (nextSpeed > EPSILON) {
    movement.heading = Math.atan2(velocity.y, velocity.x);
    transform.rotation = movement.heading;
  }
}

function correctWorldBounds(world: World, transform: TransformComponent): void {
  if (world.config.topology === 'bounded') {
    transform.position.x = clamp(transform.position.x, 0, world.config.width);
    transform.position.y = clamp(transform.position.y, 0, world.config.height);
    return;
  }

  transform.position.x = wrap(transform.position.x, world.config.width);
  transform.position.y = wrap(transform.position.y, world.config.height);
}

function resolveVelocityAgainstNormal(world: World, entityId: EntityId, normal: Vec2): void {
  if (world.staticObstacles.has(entityId) || world.pendingDeaths.has(entityId)) {
    return;
  }

  const movement = world.movements.get(entityId);
  const transform = world.transforms.get(entityId);
  if (!movement || !transform) {
    return;
  }

  const corrected = removeIntoNormal(movementVelocity(movement), normal);
  applyVelocity(movement, transform, corrected);
}

export class CollisionResolutionSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    if (world.manifolds.length === 0) {
      return;
    }

    const iterations = Math.max(1, Math.round(world.config.collisionResolveIterations));
    const slop = Math.max(0, world.config.collisionSlop);
    const percent = clamp(world.config.collisionResolvePercent, 0, 1);

    for (let pass = 0; pass < iterations; pass += 1) {
      const manifolds = world.manifolds;

      if (manifolds.length === 0) {
        break;
      }

      for (const manifold of manifolds) {
        const { aId, bId } = manifold;
        if (world.pendingDeaths.has(aId) || world.pendingDeaths.has(bId)) {
          continue;
        }

        const aTransform = world.transforms.get(aId);
        const bTransform = world.transforms.get(bId);
        if (!aTransform || !bTransform) {
          continue;
        }

        const aStatic = world.staticObstacles.has(aId);
        const bStatic = world.staticObstacles.has(bId);
        if (aStatic && bStatic) {
          continue;
        }

        const penetration = Math.max(0, manifold.penetration);
        const correctionMagnitude = Math.max(0, penetration - slop) * percent;
        const correction = mul(manifold.normal, correctionMagnitude);

        if (!aStatic && !bStatic) {
          aTransform.position = sub(aTransform.position, mul(correction, 0.5));
          bTransform.position = {
            x: bTransform.position.x + correction.x * 0.5,
            y: bTransform.position.y + correction.y * 0.5,
          };
          correctWorldBounds(world, aTransform);
          correctWorldBounds(world, bTransform);
        } else if (!aStatic) {
          aTransform.position = sub(aTransform.position, correction);
          correctWorldBounds(world, aTransform);
        } else if (!bStatic) {
          bTransform.position = {
            x: bTransform.position.x + correction.x,
            y: bTransform.position.y + correction.y,
          };
          correctWorldBounds(world, bTransform);
        }

        resolveVelocityAgainstNormal(world, aId, manifold.normal);
        resolveVelocityAgainstNormal(world, bId, mul(manifold.normal, -1));
      }
    }
  }
}
