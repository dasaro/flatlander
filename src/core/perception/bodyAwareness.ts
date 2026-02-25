import type { EntityId, VisionHitComponent } from '../components';
import type { World } from '../world';

export function entityOuterRadius(world: World, entityId: EntityId): number {
  const shape = world.shapes.get(entityId);
  if (!shape) {
    return 0;
  }
  if (shape.kind === 'segment') {
    return shape.boundingRadius + Math.max(0, world.config.lineRadius);
  }
  return shape.boundingRadius;
}

// Headless clearance estimate from current sight hit:
// distance from ray-hit to observer body envelope, not just the eye ray origin.
export function visionHitClearance(
  world: World,
  observerId: EntityId,
  hit: VisionHitComponent,
): number | null {
  if (hit.distance === null) {
    return null;
  }

  const observerRadius = entityOuterRadius(world, observerId);
  const targetRadius =
    hit.kind === 'entity' && world.entities.has(hit.hitId)
      ? entityOuterRadius(world, hit.hitId)
      : 0;

  return hit.distance - observerRadius - targetRadius;
}
