import { rankFromShape, Rank } from '../core/rank';
import { rankKeyForEntity } from '../core/rankKey';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { radialDeviation, radialPolygonVertices, regularPolygonVertices } from '../geometry/polygon';
import { clamp, distance, vec } from '../geometry/vector';
import type { System } from './system';

function boundingRadius(vertices: Array<{ x: number; y: number }>): number {
  return vertices.reduce((max, vertex) => Math.max(max, distance(vertex, vec(0, 0))), 0);
}

export class RegularizationSystem implements System {
  update(world: World, dt: number): void {
    if (!world.config.regularizationEnabled) {
      return;
    }

    const ids = getSortedEntityIds(world);
    const rate = Math.max(0, world.config.regularizationRate);
    const tolerance = Math.max(0, world.config.regularityTolerance);

    for (const id of ids) {
      const shape = world.shapes.get(id);
      const intelligence = world.intelligence.get(id);
      if (
        !shape ||
        shape.kind !== 'polygon' ||
        !(shape.irregular ?? false) ||
        !shape.radial ||
        shape.radial.length !== shape.sides ||
        shape.baseRadius === undefined ||
        !intelligence
      ) {
        continue;
      }

      const step = clamp(rate * intelligence.value * dt, 0, 1);
      if (step > 0) {
        for (let i = 0; i < shape.radial.length; i += 1) {
          const current = shape.radial[i] ?? 1;
          shape.radial[i] = current + (1 - current) * step;
        }
      }

      const deviation = radialDeviation(shape.radial);
      shape.irregularity = deviation;
      shape.vertices = radialPolygonVertices(shape.sides, shape.baseRadius, shape.radial);
      shape.boundingRadius = boundingRadius(shape.vertices);
      world.irregularity.set(id, {
        deviation,
      });

      if (deviation > tolerance) {
        continue;
      }

      const regularVertices = regularPolygonVertices(shape.sides, shape.baseRadius);
      shape.vertices = regularVertices;
      shape.boundingRadius = boundingRadius(regularVertices);
      shape.irregularity = 0;
      shape.irregular = false;
      delete shape.radial;
      delete shape.baseRadius;
      shape.regular = true;
      world.irregularity.delete(id);

      const previousRank = world.ranks.get(id);
      const nextRank = rankFromShape(shape, {
        irregularityTolerance: world.config.irregularityTolerance,
        nearCircleThreshold: world.config.nearCircleThreshold,
      });
      world.ranks.set(id, nextRank);

      if (previousRank?.rank === Rank.Irregular && nextRank.rank !== Rank.Irregular) {
        world.regularizedThisTick += 1;
        const legacy = world.legacy.get(id);
        if (legacy) {
          legacy.regularizations += 1;
        }
        const transform = world.transforms.get(id);
        if (transform) {
          world.events.push({
            type: 'regularized',
            tick: world.tick,
            entityId: id,
            pos: transform.position,
            rankKey: rankKeyForEntity(world, id),
          });
        }
      }
    }
  }
}
