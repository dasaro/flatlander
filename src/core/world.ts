import type { GeometryShape } from '../geometry/intersections';
import type { CollisionManifold } from '../geometry/collisionManifold';
import { EventQueue } from './events';
import type { WorldTopology } from './topology';
import type {
  AgeComponent,
  AudiblePing,
  BondComponent,
  BrainAngleComponent,
  CombatStatsComponent,
  DwellingComponent,
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
  JobComponent,
  KnowledgeComponent,
  LegacyComponent,
  LineageComponent,
  MovementComponent,
  NameComponent,
  NeoTherapyComponent,
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
  houseMinSpacing: number;
  rainEnabled: boolean;
  rainPeriodTicks: number;
  rainDurationTicks: number;
  rainBasePeriodTicks: number;
  rainPeriodJitterFrac: number;
  rainBaseDurationTicks: number;
  rainDurationJitterFrac: number;
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
  highOrderThresholdSides: number;
  highOrderMaleBirthPenaltyMultiplier: number;
  highOrderConceptionPenaltyMultiplier: number;
  highOrderDevelopmentJumpMax: number;
  rarityMarriageBiasEnabled: boolean;
  rarityMarriageBiasStrength: number;
  neoTherapyEnabled: boolean;
  neoTherapyEnrollmentThresholdSides: number;
  neoTherapyAmbitionProbability: number;
  neoTherapyDurationTicks: number;
  neoTherapySurvivalProbability: number;
  postpartumCooldownTicks: number;
  maxPopulation: number;
  handshakeStillnessTicks: number;
  handshakeCooldownTicks: number;
  introductionRadius: number;
  preContactRadius: number;
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
  fogFieldCellSize: number;
  fogFieldVariation: number;
  fogTorridZoneStartFrac: number;
  fogTorridZoneRelief: number;
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
  ageWearEnabled: boolean;
  ageWearStartTicks: number;
  ageWearRampTicks: number;
  ageWearRate: number;
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
  crowdStressEnabled: boolean;
  crowdStressRadius: number;
  crowdStressThreshold: number;
  crowdStressWearScale: number;
  crowdStressIrregularChance: number;
  crowdStressExecutionChance: number;
  crowdComfortPopulation: number;
  crowdOverloadWearScale: number;
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

export interface DeathTypeCounts {
  kill: number;
  attrition: number;
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
  dwellings: Map<EntityId, DwellingComponent>;
  bonds: Map<EntityId, BondComponent>;
  names: Map<EntityId, NameComponent>;
  jobs: Map<EntityId, JobComponent>;
  houseOccupants: Map<EntityId, Set<EntityId>>;
  weather: {
    isRaining: boolean;
    ticksUntilRain: number;
    ticksRemainingRain: number;
  };
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
  neoTherapy: Map<EntityId, NeoTherapyComponent>;
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
  deathTypesThisTick: DeathTypeCounts;
  deathTypesTotal: DeathTypeCounts;
  houseDoorContactsThisTick: number;
  houseEntriesThisTick: number;
  insideCountThisTick: number;
  seekShelterIntentCount: number;
  seekHomeIntentCount: number;
  stuckNearHouseCount: number;
  birthsThisTick: number;
  regularizedThisTick: number;
  handshakeStartedThisTick: number;
  handshakeCompletedThisTick: number;
  handshakeCompletedTotal: number;
  geometries: Map<EntityId, GeometryShape>;
  lastCorrections: Map<EntityId, number>;
  houseContactStreaks: Map<EntityId, { houseId: EntityId; ticks: number }>;
  houseApproachDebug: Map<
    EntityId,
    { houseId: EntityId; doorPoint: { x: number; y: number }; contactPoint: { x: number; y: number }; enterRadius: number }
  >;
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
  houseMinSpacing: 16,
  rainEnabled: false,
  rainPeriodTicks: 2000,
  rainDurationTicks: 700,
  rainBasePeriodTicks: 2000,
  rainPeriodJitterFrac: 0.24,
  rainBaseDurationTicks: 700,
  rainDurationJitterFrac: 0.18,
  peaceCryEnabled: true,
  defaultPeaceCryCadenceTicks: 20,
  defaultPeaceCryRadius: 120,
  reproductionEnabled: true,
  gestationTicks: 130,
  matingRadius: 52,
  conceptionChancePerTick: 0.02,
  femaleBirthProbability: 0.52,
  maleBirthHighRankPenaltyPerSide: 0.085,
  conceptionHighRankPenaltyPerSide: 0.13,
  highOrderThresholdSides: 12,
  highOrderMaleBirthPenaltyMultiplier: 1.9,
  highOrderConceptionPenaltyMultiplier: 2.1,
  highOrderDevelopmentJumpMax: 3,
  rarityMarriageBiasEnabled: true,
  rarityMarriageBiasStrength: 0.35,
  neoTherapyEnabled: true,
  neoTherapyEnrollmentThresholdSides: 12,
  neoTherapyAmbitionProbability: 0.2,
  neoTherapyDurationTicks: 320,
  neoTherapySurvivalProbability: 0.1,
  postpartumCooldownTicks: 90,
  maxPopulation: 650,
  handshakeStillnessTicks: 12,
  handshakeCooldownTicks: 40,
  introductionRadius: 150,
  preContactRadius: 22,
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
  fogFieldCellSize: 84,
  fogFieldVariation: 0.45,
  fogTorridZoneStartFrac: 0.72,
  fogTorridZoneRelief: 0.42,
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
  ageWearEnabled: true,
  ageWearStartTicks: 3_000,
  ageWearRampTicks: 6_000,
  ageWearRate: 0.32,
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
  crowdStressEnabled: true,
  crowdStressRadius: 54,
  crowdStressThreshold: 4,
  crowdStressWearScale: 1.0,
  crowdStressIrregularChance: 0.0012,
  crowdStressExecutionChance: 0.009,
  crowdComfortPopulation: 130,
  crowdOverloadWearScale: 2.8,
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
  if (overrides.rainEnabled === undefined) {
    config.rainEnabled = config.housesEnabled;
  }
  if (overrides.rainBasePeriodTicks === undefined) {
    config.rainBasePeriodTicks = config.rainPeriodTicks;
  }
  if (overrides.rainBaseDurationTicks === undefined) {
    config.rainBaseDurationTicks = config.rainDurationTicks;
  }
  const rainPeriod = Math.max(1, Math.round(config.rainBasePeriodTicks));
  const rainDuration = Math.max(1, Math.round(config.rainBaseDurationTicks));

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
    dwellings: new Map(),
    bonds: new Map(),
    names: new Map(),
    jobs: new Map(),
    houseOccupants: new Map(),
    weather: {
      isRaining: false,
      ticksUntilRain: rainPeriod,
      ticksRemainingRain: rainDuration,
    },
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
    neoTherapy: new Map(),
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
    deathTypesThisTick: {
      kill: 0,
      attrition: 0,
    },
    deathTypesTotal: {
      kill: 0,
      attrition: 0,
    },
    houseDoorContactsThisTick: 0,
    houseEntriesThisTick: 0,
    insideCountThisTick: 0,
    seekShelterIntentCount: 0,
    seekHomeIntentCount: 0,
    stuckNearHouseCount: 0,
    birthsThisTick: 0,
    regularizedThisTick: 0,
    handshakeStartedThisTick: 0,
    handshakeCompletedThisTick: 0,
    handshakeCompletedTotal: 0,
    geometries: new Map(),
    lastCorrections: new Map(),
    houseContactStreaks: new Map(),
    houseApproachDebug: new Map(),
    events: new EventQueue(),
  };
}

export function getSortedEntityIds(world: World): EntityId[] {
  return [...world.entities].sort((a, b) => a - b);
}
