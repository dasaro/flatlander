import { isoscelesTriangleVertices, radialPolygonVertices, regularPolygonVertices } from '../geometry/polygon';
import { distance, vec } from '../geometry/vector';
import type { GrowthComponent } from './components';
import type { ShapeComponent } from './shapes';

const SIZE_EPSILON = 1e-6;

export function createAdultGrowthComponent(
  shape: ShapeComponent,
  birthScale: number,
  maturityTicks: number,
): GrowthComponent {
  const roundedMaturityTicks = Math.max(1, Math.round(maturityTicks));
  return {
    adultSize: characteristicSize(shape),
    birthScale: clampGrowthScale(birthScale),
    maturityTicks: roundedMaturityTicks,
    currentScale: 1,
    growthTicks: roundedMaturityTicks,
  };
}

export function growthScaleAtAge(
  ageTicks: number,
  birthScale: number,
  maturityTicks: number,
): number {
  const minScale = clampGrowthScale(birthScale);
  const matureTicks = Math.max(1, Math.round(maturityTicks));
  if (ageTicks <= 0) {
    return minScale;
  }
  if (ageTicks >= matureTicks) {
    return 1;
  }
  const progress = ageTicks / matureTicks;
  return minScale + (1 - minScale) * progress;
}

export function applyGrowthToShape(
  shape: ShapeComponent,
  growth: GrowthComponent,
): number {
  const targetScale = growthScaleAtAge(growth.growthTicks, growth.birthScale, growth.maturityTicks);
  if (Math.abs(targetScale - growth.currentScale) < SIZE_EPSILON) {
    return targetScale;
  }

  const targetSize = Math.max(0.01, growth.adultSize * targetScale);
  if (shape.kind === 'segment') {
    shape.length = Math.max(2, targetSize);
    shape.boundingRadius = shape.length / 2;
  } else if (shape.kind === 'circle') {
    shape.radius = Math.max(2, targetSize);
    shape.boundingRadius = shape.radius;
  } else {
    const vertices =
      shape.sides === 3 && shape.triangleKind === 'Isosceles' && shape.isoscelesBaseRatio !== undefined
        ? isoscelesTriangleVertices(targetSize, shape.isoscelesBaseRatio)
        : shape.radial && shape.radial.length === shape.sides
          ? radialPolygonVertices(shape.sides, targetSize, shape.radial)
          : regularPolygonVertices(shape.sides, targetSize);
    shape.vertices = vertices;
    shape.boundingRadius = vertices.reduce((max, vertex) => Math.max(max, distance(vertex, vec(0, 0))), 0);
    if (shape.radial && shape.radial.length === shape.sides) {
      shape.baseRadius = targetSize;
    } else {
      delete shape.baseRadius;
    }
  }

  growth.currentScale = targetScale;
  return targetScale;
}

export function resetEntityToNewborn(growth: GrowthComponent): void {
  growth.growthTicks = 0;
}

export function resetGrowthAdultSize(
  growth: GrowthComponent,
  shape: ShapeComponent,
): void {
  const scale = Math.max(SIZE_EPSILON, growth.currentScale);
  growth.adultSize = characteristicSize(shape) / scale;
}

export function characteristicSize(shape: ShapeComponent): number {
  if (shape.kind === 'segment') {
    return shape.length;
  }
  if (shape.kind === 'circle') {
    return shape.radius;
  }
  return shape.baseRadius ?? shape.boundingRadius;
}

function clampGrowthScale(value: number): number {
  if (!Number.isFinite(value)) {
    return 0.35;
  }
  return Math.max(0.1, Math.min(1, value));
}
