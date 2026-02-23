import { getEyeWorldPosition } from '../core/eye';
import { southAttractionMultiplier } from '../core/fields/southAttractionField';
import { Rank } from '../core/rank';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

function isMoving(world: World, entityId: number): boolean {
  const movement = world.movements.get(entityId);
  if (!movement) {
    return false;
  }

  if (movement.type === 'straightDrift') {
    return Math.abs(movement.vx) + Math.abs(movement.vy) > 0;
  }

  return movement.speed > 0;
}

export class PeaceCrySystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    world.audiblePings = [];
    if (!world.config.peaceCryEnabled) {
      return;
    }

    const ids = getSortedEntityIds(world);
    for (const id of ids) {
      const rank = world.ranks.get(id);
      const peaceCry = world.peaceCry.get(id);
      const transform = world.transforms.get(id);
      if (!rank || rank.rank !== Rank.Woman || !peaceCry || !peaceCry.enabled || !transform) {
        continue;
      }

      if (!isMoving(world, id)) {
        continue;
      }

      const cadenceTicks = Math.max(1, Math.round(peaceCry.cadenceTicks));

      let effectiveRadius = Math.max(0, peaceCry.radius);
      let effectiveCadence = cadenceTicks;
      if (world.config.southStringencyEnabled) {
        const zone = southAttractionMultiplier(
          transform.position.y,
          world.config.height,
          world.config.southAttractionZoneStartFrac,
          world.config.southAttractionZoneEndFrac,
        );
        const multiplier = 1 + zone * Math.max(0, world.config.southStringencyMultiplier - 1);
        effectiveRadius *= multiplier;
        effectiveCadence = Math.max(1, Math.round(cadenceTicks / multiplier));
      }

      if (world.tick - peaceCry.lastEmitTick < effectiveCadence) {
        continue;
      }

      const eye = getEyeWorldPosition(world, id);
      world.audiblePings.push({
        emitterId: id,
        position: eye ?? transform.position,
        radius: effectiveRadius,
      });
      world.events.push({
        type: 'peaceCry',
        tick: world.tick,
        emitterId: id,
        pos: eye ?? transform.position,
        radius: effectiveRadius,
      });
      peaceCry.lastEmitTick = world.tick;
    }
  }
}
