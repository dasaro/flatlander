import type { MovementComponent } from '../core/components';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { RandomWalkBehavior, SeekPointBehavior, StraightDriftBehavior } from './movementBehaviors';
import type { MovementBehaviorStrategy } from './movementBehaviors';
import type { System } from './system';

export class MovementSystem implements System {
  private readonly behaviors: Record<MovementComponent['type'], MovementBehaviorStrategy<MovementComponent>>;

  constructor() {
    this.behaviors = {
      randomWalk: new RandomWalkBehavior(),
      straightDrift: new StraightDriftBehavior(),
      seekPoint: new SeekPointBehavior(),
    };
  }

  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
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
