import type { World } from '../core/world';
import type { System } from './system';

export class StillnessSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    const ids = [...world.stillness.keys()].sort((a, b) => a - b);

    for (const id of ids) {
      const stillness = world.stillness.get(id);
      if (!stillness) {
        continue;
      }

      stillness.ticksRemaining -= 1;
      if (stillness.ticksRemaining < 0) {
        world.stillness.delete(id);
      }
    }
  }
}
