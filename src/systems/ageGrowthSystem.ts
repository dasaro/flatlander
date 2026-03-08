import { applyGrowthToShape } from '../core/growth';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

export class AgeGrowthSystem implements System {
  update(world: World, dt: number): void {
    void dt;
    if (!world.config.ageSizeEnabled) {
      return;
    }

    const ids = getSortedEntityIds(world);
    for (const id of ids) {
      if (world.staticObstacles.has(id)) {
        continue;
      }
      const shape = world.shapes.get(id);
      const growth = world.growth.get(id);
      if (!shape || !growth) {
        continue;
      }
      if (growth.growthTicks < growth.maturityTicks) {
        growth.growthTicks += 1;
      }
      applyGrowthToShape(shape, growth);
    }
  }
}
