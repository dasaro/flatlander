import type { Vec2 } from '../geometry/vector';

export type EntityId = number;

export interface TransformComponent {
  position: Vec2;
  rotation: number;
}

export type BoundaryMode = 'wrap' | 'bounce';

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

export type MovementComponent = RandomWalkMovement | StraightDriftMovement | SeekPointMovement;

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
  distance: number;
}
