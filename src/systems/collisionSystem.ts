import { geometryFromComponents } from '../core/entityGeometry';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { aabbFromGeometry, aabbIntersects, geometriesIntersect } from '../geometry/intersections';
import { SpatialHashGrid } from '../geometry/spatialHash';
import type { System } from './system';

export class CollisionSystem implements System {
  update(world: World): void {
    const ids = getSortedEntityIds(world);
    const grid = new SpatialHashGrid(world.config.spatialHashCellSize);

    world.geometries.clear();

    const items: Array<{ id: number; aabb: ReturnType<typeof aabbFromGeometry> }> = [];
    for (const id of ids) {
      const shape = world.shapes.get(id);
      const transform = world.transforms.get(id);
      if (!shape || !transform) {
        continue;
      }

      const geometry = geometryFromComponents(shape, transform);
      world.geometries.set(id, geometry);
      items.push({
        id,
        aabb: aabbFromGeometry(geometry),
      });
    }

    world.collisions = [];
    const pairs = grid.computePairs(items);

    const itemAabb = new Map(items.map((item) => [item.id, item.aabb]));

    for (const [a, b] of pairs) {
      const aShape = world.geometries.get(a);
      const bShape = world.geometries.get(b);
      const aAabb = itemAabb.get(a);
      const bAabb = itemAabb.get(b);

      if (!aShape || !bShape || !aAabb || !bAabb) {
        continue;
      }

      if (!aabbIntersects(aAabb, bAabb)) {
        continue;
      }

      if (!geometriesIntersect(aShape, bShape)) {
        continue;
      }

      world.collisions.push({ a, b });
      world.events.emit('collision', {
        a,
        b,
        tick: world.tick,
      });
    }
  }
}
