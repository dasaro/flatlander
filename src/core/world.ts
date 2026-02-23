import type { GeometryShape } from '../geometry/intersections';
import type { CollisionManifold } from '../geometry/collisionManifold';
import { EventQueue } from './events';
import type { WorldTopology } from './topology';
import type {
  AgeComponent,
  AudiblePing,
  BrainAngleComponent,
  CombatStatsComponent,
  DurabilityComponent,
  EntityId,
  EyeComponent,
  FemaleStatusComponent,
  FeelingComponent,
  FertilityComponent,
  HearingHitComponent,
  HouseComponent,
  IntelligenceComponent,
  IrregularityComponent,
  KnowledgeComponent,
  LegacyComponent,
  LineageComponent,
  MovementComponent,
  PerceptionComponent,
  PeaceCryComponent,
  PregnancyComponent,
  SleepComponent,
  StillnessRequest,
  StillnessComponent,
  SouthDriftComponent,
  SwayComponent,
  StaticObstacleComponent,
  TransformComponent,
  VoiceComponent,
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
  housesEnabled: boolean;
  houseCount: number;
  townPopulation: number;
  allowTriangularForts: boolean;
  allowSquareHouses: boolean;
  houseSize: number;
  peaceCryEnabled: boolean;
  defaultPeaceCryCadenceTicks: number;
  defaultPeaceCryRadius: number;
  reproductionEnabled: boolean;
  gestationTicks: number;
  matingRadius: number;
  conceptionChancePerTick: number;
  femaleBirthProbability: number;
  maleBirthHighRankPenaltyPerSide: number;
  conceptionHighRankPenaltyPerSide: number;
  maxPopulation: number;
  handshakeStillnessTicks: number;
  compensationEnabled: boolean;
  compensationRate: number;
  intelligenceGrowthPerSecond: number;
  handshakeIntelligenceBonus: number;
  southStringencyEnabled: boolean;
  southStringencyMultiplier: number;
  feelingEnabledGlobal: boolean;
  feelingApproachRadius: number;
  defaultFeelingCooldownTicks: number;
  defaultFeelingApproachSpeed: number;
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
  southEscapeFraction: number;
  fogDensity: number;
  fogMinIntensity: number;
  fogMaxDistance: number;
  sightEnabled: boolean;
  defaultEyeFovDeg: number;
  lineRadius: number;
  collisionSlop: number;
  collisionResolvePercent: number;
  collisionResolveIterations: number;
  supportEpsilon: number;
  vertexContactEpsilon: number;
  feelSpeedThreshold: number;
  killThreshold: number;
  woundThreshold: number;
  killSeverityThreshold: number;
  woundSeverityThreshold: number;
  stabSharpnessExponent: number;
  pressureTicksToKill: number;
  wearEnabled: boolean;
  wearRate: number;
  wearToHpStep: number;
  stabHpDamageScale: number;
  bluntExponent: number;
  regularizationEnabled: boolean;
  regularizationRate: number;
  regularityTolerance: number;
  irregularBirthsEnabled: boolean;
  irregularBirthBaseChance: number;
  irregularBirthChance: number;
  irregularInheritanceBoost: number;
  irregularDeviationStdMinDeg: number;
  irregularDeviationStdMaxDeg: number;
  irregularDeviationCapDeg: number;
  defaultVisionRange: number;
  defaultVisionAvoidDistance: number;
  defaultVisionAvoidTurnRate: number;
  sleepEnabled: boolean;
  sleepSpeedEps: number;
  sleepCorrectionEps: number;
  sleepAfterTicks: number;
  wakeOnImpactSpeed: number;
}

export interface CollisionRecord {
  a: EntityId;
  b: EntityId;
}

export interface CollisionManifoldRecord extends CollisionManifold {
  aId: EntityId;
  bId: EntityId;
  featureA: NonNullable<CollisionManifold['featureA']>;
  featureB: NonNullable<CollisionManifold['featureB']>;
  closingSpeed: number;
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
  staticObstacles: Map<EntityId, StaticObstacleComponent>;
  houses: Map<EntityId, HouseComponent>;
  vision: Map<EntityId, VisionComponent>;
  eyes: Map<EntityId, EyeComponent>;
  visionHits: Map<EntityId, VisionHitComponent>;
  perceptions: Map<EntityId, PerceptionComponent>;
  voices: Map<EntityId, VoiceComponent>;
  hearingHits: Map<EntityId, HearingHitComponent>;
  peaceCry: Map<EntityId, PeaceCryComponent>;
  feeling: Map<EntityId, FeelingComponent>;
  knowledge: Map<EntityId, KnowledgeComponent>;
  ages: Map<EntityId, AgeComponent>;
  fertility: Map<EntityId, FertilityComponent>;
  pregnancies: Map<EntityId, PregnancyComponent>;
  lineage: Map<EntityId, LineageComponent>;
  legacy: Map<EntityId, LegacyComponent>;
  combatStats: Map<EntityId, CombatStatsComponent>;
  durability: Map<EntityId, DurabilityComponent>;
  femaleStatus: Map<EntityId, FemaleStatusComponent>;
  sway: Map<EntityId, SwayComponent>;
  stillness: Map<EntityId, StillnessComponent>;
  stillnessRequests: StillnessRequest[];
  sleep: Map<EntityId, SleepComponent>;
  intelligence: Map<EntityId, IntelligenceComponent>;
  brainAngles: Map<EntityId, BrainAngleComponent>;
  irregularity: Map<EntityId, IrregularityComponent>;
  handshakeCounts: Map<EntityId, number>;
  audiblePings: AudiblePing[];
  stabPressure: Map<string, { ticks: number }>;
  pendingDeaths: Set<EntityId>;
  collisions: CollisionRecord[];
  manifolds: CollisionManifoldRecord[];
  deathsThisTick: number;
  regularizedThisTick: number;
  geometries: Map<EntityId, GeometryShape>;
  lastCorrections: Map<EntityId, number>;
  events: EventQueue;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  width: 1000,
  height: 700,
  topology: 'torus',
  housesEnabled: false,
  houseCount: 0,
  townPopulation: 5000,
  allowTriangularForts: false,
  allowSquareHouses: false,
  houseSize: 30,
  peaceCryEnabled: true,
  defaultPeaceCryCadenceTicks: 20,
  defaultPeaceCryRadius: 120,
  reproductionEnabled: true,
  gestationTicks: 220,
  matingRadius: 52,
  conceptionChancePerTick: 0.0027,
  femaleBirthProbability: 0.54,
  maleBirthHighRankPenaltyPerSide: 0.085,
  conceptionHighRankPenaltyPerSide: 0.13,
  maxPopulation: 500,
  handshakeStillnessTicks: 12,
  compensationEnabled: false,
  compensationRate: 0.4,
  intelligenceGrowthPerSecond: 0.003,
  handshakeIntelligenceBonus: 0.01,
  southStringencyEnabled: true,
  southStringencyMultiplier: 1.9,
  feelingEnabledGlobal: true,
  feelingApproachRadius: 40,
  defaultFeelingCooldownTicks: 30,
  defaultFeelingApproachSpeed: 10,
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
  southAttractionDrag: 12,
  southAttractionMaxTerminal: 1.8,
  southEscapeFraction: 0.5,
  fogDensity: 0.012,
  fogMinIntensity: 0.1,
  fogMaxDistance: 450,
  sightEnabled: true,
  defaultEyeFovDeg: 180,
  lineRadius: 1,
  collisionSlop: 0.2,
  collisionResolvePercent: 0.8,
  collisionResolveIterations: 3,
  supportEpsilon: 1e-3,
  vertexContactEpsilon: 1.2,
  feelSpeedThreshold: 7.5,
  killThreshold: 22,
  woundThreshold: 10,
  killSeverityThreshold: 7.5,
  woundSeverityThreshold: 4,
  stabSharpnessExponent: 1.8,
  pressureTicksToKill: 120,
  wearEnabled: true,
  wearRate: 0.11,
  wearToHpStep: 7.5,
  stabHpDamageScale: 0.85,
  bluntExponent: 0.7,
  regularizationEnabled: true,
  regularizationRate: 0.15,
  regularityTolerance: 0.015,
  irregularBirthsEnabled: true,
  irregularBirthBaseChance: 0.14,
  irregularBirthChance: 0.14,
  irregularInheritanceBoost: 0.12,
  irregularDeviationStdMinDeg: 0.2,
  irregularDeviationStdMaxDeg: 0.8,
  irregularDeviationCapDeg: 2,
  defaultVisionRange: 120,
  defaultVisionAvoidDistance: 40,
  defaultVisionAvoidTurnRate: 2.5,
  sleepEnabled: true,
  sleepSpeedEps: 0.15,
  sleepCorrectionEps: 0.08,
  sleepAfterTicks: 30,
  wakeOnImpactSpeed: 0.8,
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
    staticObstacles: new Map(),
    houses: new Map(),
    vision: new Map(),
    eyes: new Map(),
    visionHits: new Map(),
    perceptions: new Map(),
    voices: new Map(),
    hearingHits: new Map(),
    peaceCry: new Map(),
    feeling: new Map(),
    knowledge: new Map(),
    ages: new Map(),
    fertility: new Map(),
    pregnancies: new Map(),
    lineage: new Map(),
    legacy: new Map(),
    combatStats: new Map(),
    durability: new Map(),
    femaleStatus: new Map(),
    sway: new Map(),
    stillness: new Map(),
    stillnessRequests: [],
    sleep: new Map(),
    intelligence: new Map(),
    brainAngles: new Map(),
    irregularity: new Map(),
    handshakeCounts: new Map(),
    audiblePings: [],
    stabPressure: new Map(),
    pendingDeaths: new Set(),
    collisions: [],
    manifolds: [],
    deathsThisTick: 0,
    regularizedThisTick: 0,
    geometries: new Map(),
    lastCorrections: new Map(),
    events: new EventQueue(),
  };
}

export function getSortedEntityIds(world: World): EntityId[] {
  return [...world.entities].sort((a, b) => a - b);
}
