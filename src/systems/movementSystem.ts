import type { MovementComponent } from '../core/components';
import { isEntityOutside } from '../core/housing/dwelling';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp, normalize, wrap } from '../geometry/vector';
import {
  RandomWalkBehavior,
  SeekPointBehavior,
  SocialNavBehavior,
  StraightDriftBehavior,
} from './movementBehaviors';
import type { MovementBehaviorStrategy } from './movementBehaviors';
import type { System } from './system';

export class MovementSystem implements System {
  private readonly behaviors: Record<MovementComponent['type'], MovementBehaviorStrategy<MovementComponent>>;

  constructor() {
    this.behaviors = {
      randomWalk: new RandomWalkBehavior(),
      straightDrift: new StraightDriftBehavior(),
      seekPoint: new SeekPointBehavior(),
      socialNav: new SocialNavBehavior(),
    };
  }

  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      if (world.staticObstacles.has(id)) {
        continue;
      }

      if (!isEntityOutside(world, id)) {
        continue;
      }

      const dwelling = world.dwellings.get(id);
      const transit = dwelling?.transit;
      if (transit?.phase === 'exiting' && transit.ticksLeft > 0) {
        const movement = world.movements.get(id);
        const transform = world.transforms.get(id);
        if (!movement || !transform) {
          continue;
        }
        const direction = normalize(transit.dirWorld);
        const speed =
          movement.type === 'straightDrift'
            ? Math.max(0, Math.hypot(movement.vx, movement.vy))
            : Math.max(0, movement.speed);
        transform.position = {
          x: transform.position.x + direction.x * speed * dt,
          y: transform.position.y + direction.y * speed * dt,
        };
        if (world.config.topology === 'torus') {
          transform.position.x = wrap(transform.position.x, world.config.width);
          transform.position.y = wrap(transform.position.y, world.config.height);
        } else {
          transform.position.x = clamp(transform.position.x, 0, world.config.width);
          transform.position.y = clamp(transform.position.y, 0, world.config.height);
        }
        transform.rotation = Math.atan2(direction.y, direction.x);
        continue;
      }

      if (world.stillness.has(id)) {
        // Stillness overrides all locomotion integration paths.
        continue;
      }

      if (world.sleep.get(id)?.asleep) {
        continue;
      }

      const movement = world.movements.get(id);
      const transform = world.transforms.get(id);
      if (!movement || !transform) {
        continue;
      }

      const behavior = this.behaviors[movement.type];
      behavior.update(id, movement, transform, world, dt);
    }
  }
}
