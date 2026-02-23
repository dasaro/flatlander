import {
  type CircleGeometry,
  type GeometryShape,
  type PolygonGeometry,
  type SegmentGeometry,
} from '../geometry/intersections';
import { minimumInternalAngle } from '../geometry/polygon';
import { radialPolygonVertices } from '../geometry/polygon';
import { add, angleToVector, mul, rotate } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { ShapeComponent } from './shapes';
import type { TransformComponent } from './components';

export function geometryFromComponents(
  shape: ShapeComponent,
  transform: TransformComponent,
): GeometryShape {
  if (shape.kind === 'circle') {
    return {
      kind: 'circle',
      center: transform.position,
      radius: shape.radius,
    };
  }

  if (shape.kind === 'segment') {
    const dir = angleToVector(transform.rotation);
    const half = mul(dir, shape.length / 2);
    return {
      kind: 'segment',
      a: add(transform.position, mul(half, -1)),
      b: add(transform.position, half),
    };
  }

  const localVertices =
    shape.radial && shape.baseRadius !== undefined && shape.radial.length === shape.sides
      ? radialPolygonVertices(shape.sides, shape.baseRadius, shape.radial)
      : shape.vertices;
  const vertices = localVertices.map((vertex) => add(transform.position, rotate(vertex, transform.rotation)));
  return {
    kind: 'polygon',
    vertices,
  };
}

export function attackPoints(shape: GeometryShape): Vec2[] {
  if (shape.kind === 'circle') {
    return [];
  }

  if (shape.kind === 'segment') {
    return [shape.a, shape.b];
  }

  return shape.vertices;
}

export function minimumAngleForGeometry(shape: GeometryShape): number {
  if (shape.kind === 'segment') {
    return 0;
  }

  if (shape.kind === 'circle') {
    return Math.PI;
  }

  return minimumInternalAngle(shape.vertices);
}

export function sharpnessForGeometry(shape: GeometryShape): number {
  return Math.PI - minimumAngleForGeometry(shape);
}

export function asPolygon(shape: GeometryShape): PolygonGeometry | null {
  return shape.kind === 'polygon' ? shape : null;
}

export function asCircle(shape: GeometryShape): CircleGeometry | null {
  return shape.kind === 'circle' ? shape : null;
}

export function asSegment(shape: GeometryShape): SegmentGeometry | null {
  return shape.kind === 'segment' ? shape : null;
}
