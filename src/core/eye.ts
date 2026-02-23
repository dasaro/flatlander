import { eyePoseWorld } from './eyePose';
import type { World } from './world';
import { angleToVector } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';

export function getForwardUnitVector(rotation: number): Vec2 {
  return angleToVector(rotation);
}

export function getEyeWorldPosition(world: World, entityId: number): Vec2 | null {
  return eyePoseWorld(world, entityId)?.eyeWorld ?? null;
}
