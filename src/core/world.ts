import type { GeometryShape } from '../geometry/intersections';
import { EventBus } from './events';
import type { WorldTopology } from './topology';
import type {
  EntityId,
  MovementComponent,
  SouthDriftComponent,
  TransformComponent,
  VisionComponent,
  VisionHitComponent,
} from './components';
import { SeededRng } from './rng';
import type { RankComponent } from './rank';
import type { ShapeComponent } from './shapes';

export interface WorldConfig {
  width: number;
  height: number;
  topology: WorldTopology;
  tickRate: number;
  maxPolygonSides: number;
  irregularityTolerance: number;
  nearCircleThreshold: number;
  irregularJitter: number;
  spatialHashCellSize: number;
  southAttractionEnabled: boolean;
  southAttractionStrength: number;
  southAttractionWomenMultiplier: number;
  southAttractionZoneStartFrac: number;
  southAttractionZoneEndFrac: number;
  southAttractionDrag: number;
  southAttractionMaxTerminal: number;
  vertexContactEpsilon: number;
  feelSpeedThreshold: number;
  killThreshold: number;
  woundThreshold: number;
  defaultVisionRange: number;
  defaultVisionAvoidDistance: number;
  defaultVisionAvoidTurnRate: number;
}

export interface CollisionRecord {
  a: EntityId;
  b: EntityId;
}

export interface WorldEvents {
  spawned: { entityId: EntityId; tick: number };
  killed: { entityId: EntityId; tick: number };
  collision: { a: EntityId; b: EntityId; tick: number };
}

export interface World {
  config: WorldConfig;
  seed: number;
  rng: SeededRng;
  tick: number;
  nextEntityId: number;
  entities: Set<EntityId>;
  transforms: Map<EntityId, TransformComponent>;
  movements: Map<EntityId, MovementComponent>;
  shapes: Map<EntityId, ShapeComponent>;
  ranks: Map<EntityId, RankComponent>;
  southDrifts: Map<EntityId, SouthDriftComponent>;
  vision: Map<EntityId, VisionComponent>;
  visionHits: Map<EntityId, VisionHitComponent>;
  pendingDeaths: Set<EntityId>;
  collisions: CollisionRecord[];
  deathsThisTick: number;
  geometries: Map<EntityId, GeometryShape>;
  events: EventBus<WorldEvents>;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  width: 1000,
  height: 700,
  topology: 'torus',
  tickRate: 30,
  maxPolygonSides: 20,
  irregularityTolerance: 0.08,
  nearCircleThreshold: 15,
  irregularJitter: 0.25,
  spatialHashCellSize: 64,
  southAttractionEnabled: true,
  southAttractionStrength: 2,
  southAttractionWomenMultiplier: 2,
  southAttractionZoneStartFrac: 0.75,
  southAttractionZoneEndFrac: 0.95,
  southAttractionDrag: 10,
  southAttractionMaxTerminal: 2,
  vertexContactEpsilon: 1.2,
  feelSpeedThreshold: 6,
  killThreshold: 18,
  woundThreshold: 10,
  defaultVisionRange: 120,
  defaultVisionAvoidDistance: 40,
  defaultVisionAvoidTurnRate: 2.5,
};

export function createWorld(seed: number, overrides: Partial<WorldConfig> = {}): World {
  const config: WorldConfig = {
    ...DEFAULT_WORLD_CONFIG,
    ...overrides,
  };

  return {
    config,
    seed,
    rng: new SeededRng(seed),
    tick: 0,
    nextEntityId: 1,
    entities: new Set(),
    transforms: new Map(),
    movements: new Map(),
    shapes: new Map(),
    ranks: new Map(),
    southDrifts: new Map(),
    vision: new Map(),
    visionHits: new Map(),
    pendingDeaths: new Set(),
    collisions: [],
    deathsThisTick: 0,
    geometries: new Map(),
    events: new EventBus<WorldEvents>(),
  };
}

export function getSortedEntityIds(world: World): EntityId[] {
  return [...world.entities].sort((a, b) => a - b);
}
