import {
  generateIrregularRadialPolygon,
  isoscelesTriangleVertices,
  radialDeviation,
  regularPolygonVertices,
  regularityMetric,
} from '../geometry/polygon';
import { clamp, distance, vec } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type {
  BoundaryMode,
  EntityId,
  FemaleRank,
  FeelingComponent,
  FertilityComponent,
  MovementComponent,
  PerceptionComponent,
  PeaceCryComponent,
  VoiceComponent,
  VisionComponent,
} from './components';
import {
  clampFemaleRank,
  defaultFemaleStatus,
  defaultSwayForFemaleRank,
} from './femaleStatus';
import { initialIntelligenceForRank } from './intelligence';
import { defaultPerceptionForRank } from './perceptionPresets';
import { rankFromShape } from './rank';
import type { Rank } from './rank';
import type { ShapeComponent, TriangleKind } from './shapes';
import { defaultVoiceComponent } from './voice';
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
  perception?: SpawnPerceptionConfig;
  voice?: SpawnVoiceConfig;
  feeling?: SpawnFeelingConfig;
  femaleStatus?: SpawnFemaleStatusConfig;
}

export interface SpawnVisionConfig {
  enabled?: boolean;
  range?: number;
  avoidDistance?: number;
  avoidTurnRate?: number;
}

export interface SpawnFeelingConfig {
  enabled?: boolean;
  approachSpeed?: number;
  feelCooldownTicks?: number;
}

export interface SpawnPerceptionConfig {
  sightSkill?: number;
  hearingSkill?: number;
  hearingRadius?: number;
}

export interface SpawnVoiceConfig {
  mimicryEnabled?: boolean;
  mimicrySignature?: VoiceComponent['mimicrySignature'];
}

export interface SpawnFemaleStatusConfig {
  femaleRank?: FemaleRank;
}

export const DEFAULT_ISOSCELES_BASE_RATIO = 0.05;
export const MIN_ISOSCELES_BASE_RATIO = 0.01;
export const MAX_ISOSCELES_BASE_RATIO = 0.95;

export function spawnFromRequest(world: World, request: SpawnRequest): EntityId[] {
  const created: EntityId[] = [];
  for (let i = 0; i < request.count; i += 1) {
    const entity = spawnEntity(
      world,
      request.shape,
      request.movement,
      undefined,
      request.vision,
      request.perception,
      request.voice,
      request.feeling,
      request.femaleStatus,
    );
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
  perceptionConfig?: SpawnPerceptionConfig,
  voiceConfig?: SpawnVoiceConfig,
  feelingConfig?: SpawnFeelingConfig,
  femaleStatusConfig?: SpawnFemaleStatusConfig,
): EntityId {
  const id = world.nextEntityId;
  world.nextEntityId += 1;

  const transformPosition =
    position ?? vec(world.rng.nextRange(0, world.config.width), world.rng.nextRange(0, world.config.height));
  const transformRotation = world.rng.nextRange(0, Math.PI * 2);

  const shape = shapeFromConfig(world, shapeConfig);
  const movement = movementFromConfig(world, movementConfig, transformPosition);
  const vision = visionFromConfig(world, visionConfig);
  const feeling = feelingFromConfig(world, feelingConfig);
  const fertility = fertilityFromShape(world, shape);
  const peaceCry = peaceCryFromShape(world, shape);
  const rank = rankFromShape(shape, {
    irregularityTolerance: world.config.irregularityTolerance,
    nearCircleThreshold: world.config.nearCircleThreshold,
  });
  const perception = perceptionFromConfig(rank.rank, perceptionConfig);
  const voice = voiceFromConfig(shape, rank.rank, voiceConfig);
  const femaleStatus = femaleStatusFromConfig(shape, femaleStatusConfig);
  const sway = femaleStatus ? defaultSwayForFemaleRank(femaleStatus.femaleRank) : null;

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
  world.perceptions.set(id, perception);
  world.voices.set(id, voice);
  world.feeling.set(id, feeling);
  world.knowledge.set(id, { known: new Map() });
  world.ages.set(id, { ticksAlive: 0 });
  world.intelligence.set(id, { value: initialIntelligenceForRank(rank) });
  if (shape.kind === 'polygon' && shape.irregular && shape.radial) {
    world.irregularity.set(id, {
      deviation: radialDeviation(shape.radial),
    });
  }
  if (fertility) {
    world.fertility.set(id, fertility);
  }
  world.combatStats.set(id, { kills: 0 });
  if (femaleStatus) {
    world.femaleStatus.set(id, femaleStatus);
  }
  if (sway) {
    world.sway.set(id, sway);
  }
  if (peaceCry) {
    world.peaceCry.set(id, peaceCry);
  }

  return id;
}

function perceptionFromConfig(rank: Rank, config?: SpawnPerceptionConfig): PerceptionComponent {
  const defaults = defaultPerceptionForRank(rank);
  return {
    sightSkill: clamp(config?.sightSkill ?? defaults.sightSkill, 0, 1),
    hearingSkill: clamp(config?.hearingSkill ?? defaults.hearingSkill, 0, 1),
    hearingRadius: Math.max(0, config?.hearingRadius ?? defaults.hearingRadius),
  };
}

function voiceFromConfig(shape: ShapeComponent, rank: Rank, config?: SpawnVoiceConfig): VoiceComponent {
  const defaults = defaultVoiceComponent(shape, rank);
  const isIsoscelesTriangle =
    shape.kind === 'polygon' && shape.sides === 3 && shape.triangleKind === 'Isosceles';
  const mimicryEnabled = isIsoscelesTriangle && Boolean(config?.mimicryEnabled);

  return {
    signature: defaults.signature,
    mimicryEnabled,
    mimicrySignature: mimicryEnabled ? (config?.mimicrySignature ?? defaults.mimicrySignature) : null,
  };
}

function femaleStatusFromConfig(
  shape: ShapeComponent,
  config?: SpawnFemaleStatusConfig,
): { femaleRank: FemaleRank } | null {
  if (shape.kind !== 'segment') {
    return null;
  }

  const defaults = defaultFemaleStatus();
  return {
    femaleRank: clampFemaleRank(config?.femaleRank ?? defaults.femaleRank),
  };
}

function visionFromConfig(world: World, config?: SpawnVisionConfig): VisionComponent {
  return {
    enabled: config?.enabled ?? true,
    range: Math.max(0, config?.range ?? world.config.defaultVisionRange),
    avoidDistance: Math.max(0, config?.avoidDistance ?? world.config.defaultVisionAvoidDistance),
    avoidTurnRate: Math.max(0, config?.avoidTurnRate ?? world.config.defaultVisionAvoidTurnRate),
  };
}

function peaceCryFromShape(world: World, shape: ShapeComponent): PeaceCryComponent | null {
  if (shape.kind !== 'segment') {
    return null;
  }

  const cadenceTicks = Math.max(1, Math.round(world.config.defaultPeaceCryCadenceTicks));
  return {
    enabled: world.config.peaceCryEnabled,
    cadenceTicks,
    radius: Math.max(0, world.config.defaultPeaceCryRadius),
    lastEmitTick: world.tick - cadenceTicks,
  };
}

function fertilityFromShape(world: World, shape: ShapeComponent): FertilityComponent | null {
  if (shape.kind !== 'segment') {
    return null;
  }

  const gestationTicks = Math.max(1, Math.round(world.config.gestationTicks));
  return {
    enabled: true,
    maturityTicks: gestationTicks,
    cooldownTicks: gestationTicks,
    lastBirthTick: Number.NEGATIVE_INFINITY,
  };
}

function feelingFromConfig(world: World, config?: SpawnFeelingConfig): FeelingComponent {
  return {
    enabled: config?.enabled ?? world.config.feelingEnabledGlobal,
    approachSpeed: Math.max(0, config?.approachSpeed ?? world.config.defaultFeelingApproachSpeed),
    feelCooldownTicks: Math.max(
      0,
      Math.round(config?.feelCooldownTicks ?? world.config.defaultFeelingCooldownTicks),
    ),
    lastFeltTick: Number.NEGATIVE_INFINITY,
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
  let irregular = false;
  let triangleKind: TriangleKind | undefined;
  let isoscelesBaseRatio: number | undefined;
  let radial: number[] | undefined;
  let baseRadius: number | undefined;

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
    irregular = false;
  } else if (config.irregular) {
    const irregularResult = generateIrregularRadialPolygon(
      sides,
      radius,
      world.config.irregularJitter,
      world.rng,
    );
    vertices = irregularResult.vertices;
    irregularity = irregularResult.irregularity;
    radial = irregularResult.radial;
    baseRadius = radius;
    regular = false;
    irregular = true;
  } else {
    vertices = regularPolygonVertices(sides, radius);
    irregularity = 0;
    regular = true;
    irregular = false;
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
    irregular,
    boundingRadius,
    ...(radial ? { radial } : {}),
    ...(baseRadius !== undefined ? { baseRadius } : {}),
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
