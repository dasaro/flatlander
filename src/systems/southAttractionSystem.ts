import { southAttractionMultiplier } from '../core/fields/southAttractionField';
import { isEntityOutside } from '../core/housing/dwelling';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp } from '../geometry/vector';
import type { System } from './system';

const MIN_DRAG = 1e-6;

function entityMaxSpeed(world: World, entityId: number): number {
  const movement = world.movements.get(entityId);
  if (!movement) {
    return 0;
  }

  if (movement.type === 'straightDrift') {
    return Math.hypot(movement.vx, movement.vy);
  }

  return Math.max(0, movement.speed);
}

export class SouthAttractionSystem implements System {
  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);
    const drag = Math.max(world.config.southAttractionDrag, MIN_DRAG);
    const maxTerminal = Math.max(0, world.config.southAttractionMaxTerminal);

    for (const id of ids) {
      const transform = world.transforms.get(id);
      const shape = world.shapes.get(id);
      const drift = world.southDrifts.get(id);
      if (!transform || !shape || !drift) {
        continue;
      }
      if (!isEntityOutside(world, id)) {
        continue;
      }
      if (world.stillness.has(id)) {
        continue;
      }

      let effectiveAcceleration = 0;
      if (world.config.southAttractionEnabled && world.config.southAttractionStrength > 0) {
        const zoneMultiplier = southAttractionMultiplier(
          transform.position.y,
          world.config.height,
          world.config.southAttractionZoneStartFrac,
          world.config.southAttractionZoneEndFrac,
        );
        const womenMultiplier = shape.kind === 'segment' ? world.config.southAttractionWomenMultiplier : 1;
        effectiveAcceleration = world.config.southAttractionStrength * zoneMultiplier * womenMultiplier;
      }

      drift.vy += (effectiveAcceleration - drag * drift.vy) * dt;
      const maxSpeed = entityMaxSpeed(world, id);
      const localEscapeCap =
        maxSpeed > 0 ? Math.max(0, world.config.southEscapeFraction) * maxSpeed : maxTerminal;
      const localMaxTerminal = Math.min(maxTerminal, localEscapeCap);
      drift.vy = clamp(drift.vy, -localMaxTerminal, localMaxTerminal);
    }
  }
}
