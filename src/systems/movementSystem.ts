import type { MovementComponent } from '../core/components';
import { isEntityOutside } from '../core/housing/dwelling';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
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
