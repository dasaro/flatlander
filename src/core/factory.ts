import {
  generateIrregularConvexPolygon,
  isoscelesTriangleVertices,
  regularPolygonVertices,
  regularityMetric,
} from '../geometry/polygon';
import { clamp, distance, vec } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { BoundaryMode, EntityId, MovementComponent, VisionComponent } from './components';
import { rankFromShape } from './rank';
import type { ShapeComponent, TriangleKind } from './shapes';
import type { World } from './world';

export interface SegmentSpawnConfig {
  kind: 'segment';
  size: number;
}

export interface CircleSpawnConfig {
  kind: 'circle';
  size: number;
}

export interface PolygonSpawnConfig {
  kind: 'polygon';
  size: number;
  sides: number;
  irregular: boolean;
  triangleKind?: TriangleKind;
  isoscelesBaseRatio?: number;
}

export type SpawnShapeConfig = SegmentSpawnConfig | CircleSpawnConfig | PolygonSpawnConfig;

export interface RandomWalkSpawnMovement {
  type: 'randomWalk';
  speed: number;
  turnRate: number;
  boundary: BoundaryMode;
}

export interface StraightDriftSpawnMovement {
  type: 'straightDrift';
  vx: number;
  vy: number;
  boundary: BoundaryMode;
}

export interface SeekPointSpawnMovement {
  type: 'seekPoint';
  target: Vec2;
  speed: number;
  turnRate: number;
  boundary: BoundaryMode;
}

export type SpawnMovementConfig =
  | RandomWalkSpawnMovement
  | StraightDriftSpawnMovement
  | SeekPointSpawnMovement;

export interface SpawnRequest {
  shape: SpawnShapeConfig;
  movement: SpawnMovementConfig;
  count: number;
  vision?: SpawnVisionConfig;
}

export interface SpawnVisionConfig {
  enabled?: boolean;
  range?: number;
  avoidDistance?: number;
  avoidTurnRate?: number;
}

export const DEFAULT_ISOSCELES_BASE_RATIO = 0.05;
export const MIN_ISOSCELES_BASE_RATIO = 0.01;
export const MAX_ISOSCELES_BASE_RATIO = 0.95;

export function spawnFromRequest(world: World, request: SpawnRequest): EntityId[] {
  const created: EntityId[] = [];
  for (let i = 0; i < request.count; i += 1) {
    const entity = spawnEntity(world, request.shape, request.movement, undefined, request.vision);
    created.push(entity);
  }
  return created;
}

export function spawnEntity(
  world: World,
  shapeConfig: SpawnShapeConfig,
  movementConfig: SpawnMovementConfig,
  position?: Vec2,
  visionConfig?: SpawnVisionConfig,
): EntityId {
  const id = world.nextEntityId;
  world.nextEntityId += 1;

  const transformPosition =
    position ?? vec(world.rng.nextRange(0, world.config.width), world.rng.nextRange(0, world.config.height));
  const transformRotation = world.rng.nextRange(0, Math.PI * 2);

  const shape = shapeFromConfig(world, shapeConfig);
  const movement = movementFromConfig(world, movementConfig, transformPosition);
  const vision = visionFromConfig(world, visionConfig);
  const rank = rankFromShape(shape, {
    irregularityTolerance: world.config.irregularityTolerance,
    nearCircleThreshold: world.config.nearCircleThreshold,
  });

  world.entities.add(id);
  world.transforms.set(id, {
    position: transformPosition,
    rotation: transformRotation,
  });
  world.shapes.set(id, shape);
  world.movements.set(id, movement);
  world.ranks.set(id, rank);
  world.southDrifts.set(id, { vy: 0 });
  world.vision.set(id, vision);

  world.events.emit('spawned', {
    entityId: id,
    tick: world.tick,
  });

  return id;
}

function visionFromConfig(world: World, config?: SpawnVisionConfig): VisionComponent {
  return {
    enabled: config?.enabled ?? true,
    range: Math.max(0, config?.range ?? world.config.defaultVisionRange),
    avoidDistance: Math.max(0, config?.avoidDistance ?? world.config.defaultVisionAvoidDistance),
    avoidTurnRate: Math.max(0, config?.avoidTurnRate ?? world.config.defaultVisionAvoidTurnRate),
  };
}

function shapeFromConfig(world: World, config: SpawnShapeConfig): ShapeComponent {
  if (config.kind === 'segment') {
    const length = Math.max(2, config.size);
    return {
      kind: 'segment',
      length,
      boundingRadius: length / 2,
    };
  }

  if (config.kind === 'circle') {
    const radius = Math.max(2, config.size);
    return {
      kind: 'circle',
      radius,
      boundingRadius: radius,
    };
  }

  const sides = Math.max(3, Math.min(world.config.maxPolygonSides, Math.round(config.sides)));
  const radius = Math.max(4, config.size);

  let vertices: Vec2[];
  let irregularity: number;
  let regular: boolean;
  let triangleKind: TriangleKind | undefined;
  let isoscelesBaseRatio: number | undefined;

  if (sides === 3 && config.triangleKind === 'Isosceles') {
    triangleKind = 'Isosceles';
    isoscelesBaseRatio = clamp(
      config.isoscelesBaseRatio ?? DEFAULT_ISOSCELES_BASE_RATIO,
      MIN_ISOSCELES_BASE_RATIO,
      MAX_ISOSCELES_BASE_RATIO,
    );
    vertices = isoscelesTriangleVertices(radius, isoscelesBaseRatio);
    irregularity = regularityMetric(vertices);
    regular = false;
  } else if (config.irregular) {
    const irregular = generateIrregularConvexPolygon(
      sides,
      radius,
      world.config.irregularJitter,
      world.rng,
    );
    vertices = irregular.vertices;
    irregularity = irregular.irregularity;
    regular = false;
  } else {
    vertices = regularPolygonVertices(sides, radius);
    irregularity = regularityMetric(vertices);
    regular = true;
    if (sides === 3) {
      triangleKind = 'Equilateral';
    }
  }

  const boundingRadius = vertices.reduce(
    (max, vertex) => Math.max(max, distance(vertex, vec(0, 0))),
    0,
  );

  return {
    kind: 'polygon',
    sides,
    vertices,
    irregularity,
    regular,
    boundingRadius,
    ...(triangleKind ? { triangleKind } : {}),
    ...(isoscelesBaseRatio !== undefined ? { isoscelesBaseRatio } : {}),
  };
}

function movementFromConfig(
  world: World,
  config: SpawnMovementConfig,
  position: Vec2,
): MovementComponent {
  if (config.type === 'randomWalk') {
    return {
      ...config,
      heading: world.rng.nextRange(0, Math.PI * 2),
    };
  }

  if (config.type === 'straightDrift') {
    return {
      ...config,
    };
  }

  const heading = Math.atan2(config.target.y - position.y, config.target.x - position.x);
  return {
    ...config,
    heading,
  };
}
