import type { Vec2 } from '../geometry/vector';

export type ShapeKind = 'segment' | 'circle' | 'polygon';
export type TriangleKind = 'Equilateral' | 'Isosceles';

export interface SegmentShape {
  kind: 'segment';
  length: number;
  boundingRadius: number;
}

export interface CircleShape {
  kind: 'circle';
  radius: number;
  boundingRadius: number;
}

export interface PolygonShape {
  kind: 'polygon';
  sides: number;
  vertices: Vec2[];
  irregularity: number;
  regular: boolean;
  boundingRadius: number;
  irregular?: boolean;
  baseRadius?: number;
  radial?: number[];
  triangleKind?: TriangleKind;
  isoscelesBaseRatio?: number;
}

export type ShapeComponent = SegmentShape | CircleShape | PolygonShape;
