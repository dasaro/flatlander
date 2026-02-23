import type { Vec2 } from '../geometry/vector';
import type { Rank } from './rank';

export type EntityId = number;

export interface TransformComponent {
  position: Vec2;
  rotation: number;
}

export type BoundaryMode = 'wrap' | 'bounce';

export type SocialIntention =
  | 'roam'
  | 'avoid'
  | 'yield'
  | 'approachMate'
  | 'approachForFeeling';

export interface SocialNavGoal {
  type: 'point' | 'direction';
  x?: number;
  y?: number;
  heading?: number;
  targetId?: EntityId;
}

export interface RandomWalkMovement {
  type: 'randomWalk';
  speed: number;
  turnRate: number;
  heading: number;
  boundary: BoundaryMode;
}

export interface StraightDriftMovement {
  type: 'straightDrift';
  vx: number;
  vy: number;
  boundary: BoundaryMode;
}

export interface SeekPointMovement {
  type: 'seekPoint';
  target: Vec2;
  speed: number;
  turnRate: number;
  heading: number;
  boundary: BoundaryMode;
}

export interface SocialNavMovement {
  type: 'socialNav';
  speed: number;
  turnRate: number;
  heading: number;
  boundary: BoundaryMode;
  maxSpeed: number;
  maxTurnRate: number;
  decisionEveryTicks: number;
  intentionMinTicks: number;
  intention: SocialIntention;
  intentionTicksLeft: number;
  goal?: SocialNavGoal;
  smoothHeading: number;
  smoothSpeed: number;
}

export type MovementComponent =
  | RandomWalkMovement
  | StraightDriftMovement
  | SeekPointMovement
  | SocialNavMovement;

export interface SouthDriftComponent {
  vy: number;
}

export interface VisionComponent {
  enabled: boolean;
  range: number;
  avoidDistance: number;
  avoidTurnRate: number;
}

export interface VisionHitComponent {
  hitId: EntityId;
  distance: number | null;
  distanceReliable: boolean;
  intensity: number;
  direction: Vec2;
  kind: 'entity' | 'boundary';
  boundarySide?: 'north' | 'south' | 'west' | 'east';
}

export interface PerceptionComponent {
  sightSkill: number;
  hearingSkill: number;
  hearingRadius: number;
}

export type VoiceSignature = 'WomanCry' | 'Equilateral' | 'Square' | 'Pentagon' | 'HighOrder';

export interface VoiceComponent {
  signature: VoiceSignature;
  mimicryEnabled: boolean;
  mimicrySignature: VoiceSignature | null;
}

export interface HearingHitComponent {
  otherId: EntityId;
  signature: VoiceSignature;
  distance: number;
  direction: Vec2;
}

export interface StaticObstacleComponent {
  kind: 'house';
}

export type HouseKind = 'Pentagon' | 'Square' | 'TriangleFort';

export interface HouseComponent {
  houseKind: HouseKind;
  doorEastWorld: Vec2;
  doorWestWorld: Vec2;
}

export interface PeaceCryComponent {
  enabled: boolean;
  cadenceTicks: number;
  radius: number;
  lastEmitTick: number;
}

export interface AudiblePing {
  emitterId: EntityId;
  position: Vec2;
  radius: number;
}

export interface KnownInfo {
  rank: Rank;
  learnedBy: 'feeling';
  learnedAtTick: number;
}

export interface KnowledgeComponent {
  known: Map<EntityId, KnownInfo>;
}

export interface FeelingComponent {
  enabled: boolean;
  approachSpeed: number;
  feelCooldownTicks: number;
  lastFeltTick: number;
}

export interface AgeComponent {
  ticksAlive: number;
}

export interface FertilityComponent {
  enabled: boolean;
  maturityTicks: number;
  cooldownTicks: number;
  lastBirthTick: number;
}

export interface PregnancyComponent {
  fatherId: EntityId;
  ticksRemaining: number;
}

export interface LineageComponent {
  id: EntityId;
  birthTick: number;
  motherId: EntityId | null;
  fatherId: EntityId | null;
  generation: number;
  dynastyId: EntityId;
}

export interface CombatStatsComponent {
  kills: number;
}

export interface LegacyComponent {
  births: number;
  deathsCaused: number;
  handshakes: number;
  regularizations: number;
  descendantsAlive: number;
}

export type FemaleRank = 'Low' | 'Middle' | 'High';

export interface FemaleStatusComponent {
  femaleRank: FemaleRank;
}

export interface SwayComponent {
  enabled: boolean;
  baseAmplitudeRad: number;
  baseFrequencyHz: number;
  phase: number;
}

export interface StillnessComponent {
  ticksRemaining: number;
}

export interface IntelligenceComponent {
  value: number;
}

export interface BrainAngleComponent {
  brainAngleDeg: number;
}

export interface IrregularityComponent {
  deviation: number;
  angleDeviationDeg?: number;
}

export interface DurabilityComponent {
  hp: number;
  maxHp: number;
  wear: number;
}

export interface SleepComponent {
  asleep: boolean;
  stillTicks: number;
}
