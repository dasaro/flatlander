import { regularPolygonVertices, regularityMetric } from '../../geometry/polygon';
import { add, distance, normalize, rotate, sub } from '../../geometry/vector';
import type { Vec2 } from '../../geometry/vector';
import type { DoorSpec, HouseComponent, HouseKind, TransformComponent } from '../components';
import type { ShapeComponent } from '../shapes';

interface HouseLayout {
  verticesLocal: Vec2[];
  doorEast: DoorSpec;
  doorWest: DoorSpec;
  doorEnterRadius: number;
}

function centroid(vertices: Vec2[]): Vec2 {
  if (vertices.length === 0) {
    return { x: 0, y: 0 };
  }

  let sx = 0;
  let sy = 0;
  for (const vertex of vertices) {
    sx += vertex.x;
    sy += vertex.y;
  }
  return {
    x: sx / vertices.length,
    y: sy / vertices.length,
  };
}

function midpoint(a: Vec2, b: Vec2): Vec2 {
  return {
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5,
  };
}

function doorSpecFromEdge(side: 'east' | 'west', a: Vec2, b: Vec2, center: Vec2): DoorSpec {
  const mid = midpoint(a, b);
  return {
    side,
    localMidpoint: mid,
    localNormalInward: normalize(sub(center, mid)),
    // Part I §2: east doors are smaller (women), west doors larger (men).
    sizeFactor: side === 'east' ? 0.65 : 1.25,
  };
}

function edgeAtExtremeX(
  vertices: Vec2[],
  mode: 'max' | 'min',
): { a: Vec2; b: Vec2 } {
  let bestEdge: { a: Vec2; b: Vec2 } | null = null;
  let bestValue = mode === 'max' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    if (!a || !b) {
      continue;
    }
    const value = (a.x + b.x) * 0.5;
    const better = mode === 'max' ? value > bestValue : value < bestValue;
    if (better) {
      bestValue = value;
      bestEdge = { a, b };
    }
  }

  if (!bestEdge) {
    throw new Error('Unable to resolve house edge for door placement.');
  }

  return bestEdge;
}

function layoutFromVertices(verticesLocal: Vec2[]): HouseLayout {
  const center = centroid(verticesLocal);
  const eastEdge = edgeAtExtremeX(verticesLocal, 'max');
  const westEdge = edgeAtExtremeX(verticesLocal, 'min');
  const eastMid = midpoint(eastEdge.a, eastEdge.b);
  const westMid = midpoint(westEdge.a, westEdge.b);
  const doorEnterRadius = Math.max(4, Math.min(24, 0.18 * distance(eastMid, westMid)));

  return {
    verticesLocal,
    doorEast: doorSpecFromEdge('east', eastEdge.a, eastEdge.b, center),
    doorWest: doorSpecFromEdge('west', westEdge.a, westEdge.b, center),
    doorEnterRadius,
  };
}

// Part I §2: a canonical pentagonal house with a north roof apex and side doors.
export function createCanonicalPentagonHouse(width: number, height: number): HouseLayout {
  const halfW = Math.max(8, width * 0.5);
  const halfH = Math.max(8, height * 0.5);
  const shoulderX = halfW * 0.72;
  const shoulderY = -halfH * 0.18;

  const verticesLocal: Vec2[] = [
    { x: -halfW, y: halfH }, // south-west base
    { x: halfW, y: halfH }, // south-east base
    { x: shoulderX, y: shoulderY }, // east wall/roof join
    { x: 0, y: -halfH }, // north roof apex
    { x: -shoulderX, y: shoulderY }, // west wall/roof join
  ];
  return layoutFromVertices(verticesLocal);
}

function createRegularHouse(kind: Exclude<HouseKind, 'Pentagon'>, size: number): HouseLayout {
  const sides = kind === 'Square' ? 4 : 3;
  const local = regularPolygonVertices(sides, Math.max(8, size)).map((vertex) => rotate(vertex, -Math.PI / 2));
  return layoutFromVertices(local);
}

export function createHouseLayout(kind: HouseKind, size: number): HouseLayout {
  if (kind === 'Pentagon') {
    return createCanonicalPentagonHouse(size * 1.35, size * 1.2);
  }
  return createRegularHouse(kind, size);
}

export function houseShapeFromLayout(layout: HouseLayout): ShapeComponent {
  const radius = layout.verticesLocal.reduce((max, vertex) => Math.max(max, distance(vertex, { x: 0, y: 0 })), 0);
  return {
    kind: 'polygon',
    sides: layout.verticesLocal.length,
    vertices: layout.verticesLocal,
    regular: false,
    irregularity: regularityMetric(layout.verticesLocal),
    boundingRadius: radius,
    irregular: false,
  };
}

export function houseComponentFromLayout(
  kind: HouseKind,
  layout: HouseLayout,
  indoorCapacity: number | null = null,
): HouseComponent {
  return {
    kind: 'house',
    houseKind: kind,
    polygon: {
      verticesLocal: layout.verticesLocal,
    },
    doorEast: layout.doorEast,
    doorWest: layout.doorWest,
    doorEnterRadius: layout.doorEnterRadius,
    indoorCapacity,
  };
}

export function doorPoseWorld(
  transform: TransformComponent,
  door: DoorSpec,
): { midpoint: Vec2; normalInward: Vec2 } {
  return {
    midpoint: add(transform.position, rotate(door.localMidpoint, transform.rotation)),
    normalInward: normalize(rotate(door.localNormalInward, transform.rotation)),
  };
}

export function houseCentroidWorld(transform: TransformComponent, house: HouseComponent): Vec2 {
  const center = centroid(house.polygon.verticesLocal);
  return add(transform.position, rotate(center, transform.rotation));
}
