import type {
  MovementComponent,
  RandomWalkMovement,
  SocialNavMovement,
  SeekPointMovement,
  StraightDriftMovement,
  TransformComponent,
} from '../core/components';
import type { World } from '../core/world';
import { EPSILON, angleToVector, clamp, normalize, sub, vec, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';

export interface MovementBehaviorStrategy<T extends MovementComponent = MovementComponent> {
  readonly type: T['type'];
  update(entityId: number, movement: T, transform: TransformComponent, world: World, dt: number): void;
}

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
  const clamped = clamp(delta, -maxDelta, maxDelta);
  return normalizeAngle(current + clamped);
}

function stepTransform(transform: TransformComponent, velocity: Vec2, dt: number): void {
  transform.position = {
    x: transform.position.x + velocity.x * dt,
    y: transform.position.y + velocity.y * dt,
  };
}

function speedOf(velocity: Vec2): number {
  return Math.hypot(velocity.x, velocity.y);
}

function velocityWithSouthDrift(world: World, entityId: number, intendedVelocity: Vec2): Vec2 {
  const driftVy = world.southDrifts.get(entityId)?.vy ?? 0;
  return {
    x: intendedVelocity.x,
    y: intendedVelocity.y + driftVy,
  };
}

function applyBoundary(world: World, movement: MovementComponent, velocity: Vec2, transform: TransformComponent): Vec2 {
  const { width, height } = world.config;

  if (movement.boundary === 'wrap') {
    transform.position = {
      x: wrap(transform.position.x, width),
      y: wrap(transform.position.y, height),
    };
    return velocity;
  }

  let vx = velocity.x;
  let vy = velocity.y;

  if (transform.position.x < 0) {
    transform.position.x = 0;
    vx = Math.abs(vx);
  } else if (transform.position.x > width) {
    transform.position.x = width;
    vx = -Math.abs(vx);
  }

  if (transform.position.y < 0) {
    transform.position.y = 0;
    vy = Math.abs(vy);
  } else if (transform.position.y > height) {
    transform.position.y = height;
    vy = -Math.abs(vy);
  }

  return vec(vx, vy);
}

export class RandomWalkBehavior implements MovementBehaviorStrategy<RandomWalkMovement> {
  readonly type = 'randomWalk' as const;

  update(
    entityId: number,
    movement: RandomWalkMovement,
    transform: TransformComponent,
    world: World,
    dt: number,
  ): void {
    const turnDelta = world.rng.nextRange(-movement.turnRate, movement.turnRate) * dt;
    movement.heading = normalizeAngle(movement.heading + turnDelta);

    const baseVelocity = angleToVector(movement.heading);
    const intendedVelocity = {
      x: baseVelocity.x * movement.speed,
      y: baseVelocity.y * movement.speed,
    };
    let velocity = velocityWithSouthDrift(world, entityId, intendedVelocity);

    stepTransform(transform, velocity, dt);
    velocity = applyBoundary(world, movement, velocity, transform);

    const speed = speedOf(velocity);
    if (speed > EPSILON) {
      movement.heading = normalizeAngle(Math.atan2(velocity.y, velocity.x));
      transform.rotation = movement.heading;
    }
  }
}

export class StraightDriftBehavior implements MovementBehaviorStrategy<StraightDriftMovement> {
  readonly type = 'straightDrift' as const;

  update(
    entityId: number,
    movement: StraightDriftMovement,
    transform: TransformComponent,
    world: World,
    dt: number,
  ): void {
    const intendedVelocity = vec(movement.vx, movement.vy);
    const driftVy = world.southDrifts.get(entityId)?.vy ?? 0;
    let velocity = velocityWithSouthDrift(world, entityId, intendedVelocity);

    stepTransform(transform, velocity, dt);
    velocity = applyBoundary(world, movement, velocity, transform);

    movement.vx = velocity.x;
    movement.vy = velocity.y - driftVy;
    if (speedOf(velocity) > EPSILON) {
      transform.rotation = normalizeAngle(Math.atan2(velocity.y, velocity.x));
    }
  }
}

export class SeekPointBehavior implements MovementBehaviorStrategy<SeekPointMovement> {
  readonly type = 'seekPoint' as const;

  update(
    entityId: number,
    movement: SeekPointMovement,
    transform: TransformComponent,
    world: World,
    dt: number,
  ): void {
    const toTarget = sub(movement.target, transform.position);
    const desired = normalize(toTarget);

    if (Math.abs(desired.x) > 0 || Math.abs(desired.y) > 0) {
      const targetHeading = Math.atan2(desired.y, desired.x);
      movement.heading = rotateTowards(movement.heading, targetHeading, movement.turnRate * dt);
    }

    const baseVelocity = angleToVector(movement.heading);
    const intendedVelocity = {
      x: baseVelocity.x * movement.speed,
      y: baseVelocity.y * movement.speed,
    };
    let velocity = velocityWithSouthDrift(world, entityId, intendedVelocity);

    stepTransform(transform, velocity, dt);
    velocity = applyBoundary(world, movement, velocity, transform);

    const speed = speedOf(velocity);
    if (speed > EPSILON) {
      movement.heading = normalizeAngle(Math.atan2(velocity.y, velocity.x));
      transform.rotation = movement.heading;
    }
  }
}

export class SocialNavBehavior implements MovementBehaviorStrategy<SocialNavMovement> {
  readonly type = 'socialNav' as const;

  update(
    entityId: number,
    movement: SocialNavMovement,
    transform: TransformComponent,
    world: World,
    dt: number,
  ): void {
    const baseVelocity = angleToVector(movement.heading);
    const intendedVelocity = {
      x: baseVelocity.x * movement.speed,
      y: baseVelocity.y * movement.speed,
    };
    let velocity = velocityWithSouthDrift(world, entityId, intendedVelocity);

    stepTransform(transform, velocity, dt);
    velocity = applyBoundary(world, movement, velocity, transform);

    const nextSpeed = Math.max(0, speedOf(velocity));
    if (nextSpeed > EPSILON) {
      movement.heading = normalizeAngle(Math.atan2(velocity.y, velocity.x));
      movement.smoothHeading = movement.heading;
      transform.rotation = movement.heading;
    }
    movement.speed = nextSpeed;
    movement.smoothSpeed = movement.speed;
  }
}
