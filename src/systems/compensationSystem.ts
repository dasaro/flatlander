import { regularityMetric, isoscelesTriangleVertices } from '../geometry/polygon';
import { clamp, distance, vec } from '../geometry/vector';
import { MAX_ISOSCELES_BASE_RATIO, MIN_ISOSCELES_BASE_RATIO } from '../core/factory';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

function edgeLength(vertices: Array<{ x: number; y: number }>, a: number, b: number): number {
  const va = vertices[a];
  const vb = vertices[b];
  if (!va || !vb) {
    return 1;
  }
  return distance(va, vb);
}

function equalSideLength(vertices: Array<{ x: number; y: number }>): number {
  if (vertices.length !== 3) {
    return 1;
  }

  return Math.max(
    edgeLength(vertices, 0, 2),
    edgeLength(vertices, 1, 2),
    edgeLength(vertices, 0, 1),
  );
}

export class CompensationSystem implements System {
  update(world: World, dt: number): void {
    if (!world.config.compensationEnabled) {
      return;
    }

    const rate = Math.max(0, world.config.compensationRate);
    if (rate <= 0) {
      return;
    }

    const ids = getSortedEntityIds(world);
    for (const id of ids) {
      const shape = world.shapes.get(id);
      const intelligence = world.intelligence.get(id);
      if (!shape || !intelligence) {
        continue;
      }

      if (
        shape.kind !== 'polygon' ||
        shape.sides !== 3 ||
        shape.triangleKind !== 'Isosceles' ||
        shape.isoscelesBaseRatio === undefined
      ) {
        continue;
      }

      const currentRatio = shape.isoscelesBaseRatio;
      const step = clamp(rate * intelligence.value * dt, 0, 1);
      const nextRatio = clamp(
        currentRatio + (MAX_ISOSCELES_BASE_RATIO - currentRatio) * step,
        MIN_ISOSCELES_BASE_RATIO,
        MAX_ISOSCELES_BASE_RATIO,
      );

      if (nextRatio <= currentRatio + 1e-9) {
        continue;
      }

      const side = Math.max(1, equalSideLength(shape.vertices));
      const vertices = isoscelesTriangleVertices(side, nextRatio);

      shape.vertices = vertices;
      shape.isoscelesBaseRatio = nextRatio;
      shape.irregularity = regularityMetric(vertices);
      shape.boundingRadius = vertices.reduce(
        (max, vertex) => Math.max(max, distance(vertex, vec(0, 0))),
        0,
      );
    }
  }
}
