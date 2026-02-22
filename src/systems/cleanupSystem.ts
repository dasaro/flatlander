import type { World } from '../core/world';
import type { System } from './system';

export class CleanupSystem implements System {
  update(world: World): void {
    const toRemove = [...world.pendingDeaths].sort((a, b) => a - b);
    world.deathsThisTick = toRemove.length;

    for (const id of toRemove) {
      world.entities.delete(id);
      world.transforms.delete(id);
      world.movements.delete(id);
      world.shapes.delete(id);
      world.ranks.delete(id);
      world.southDrifts.delete(id);
      world.vision.delete(id);
      world.visionHits.delete(id);
      world.geometries.delete(id);

      world.events.emit('killed', {
        entityId: id,
        tick: world.tick,
      });
    }

    world.pendingDeaths.clear();
  }
}
