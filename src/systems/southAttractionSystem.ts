import { southAttractionMultiplier } from '../core/fields/southAttractionField';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp } from '../geometry/vector';
import type { System } from './system';

const MIN_DRAG = 1e-6;

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
      drift.vy = clamp(drift.vy, -maxTerminal, maxTerminal);
    }
  }
}
