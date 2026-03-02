import { getEyeWorldPosition } from '../core/eye';
import { southAttractionMultiplier } from '../core/fields/southAttractionField';
import { isEntityOutside } from '../core/housing/dwelling';
import { rankKeyForEntity } from '../core/rankKey';
import { Rank } from '../core/rank';
import { requestStillness } from '../core/stillness';
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

function requestComplianceStillness(world: World, entityId: number, position: { x: number; y: number }): void {
  const ticks = Math.max(1, Math.round(world.config.peaceCryComplianceStillnessTicks));
  const existing = world.stillness.get(entityId);
  const alreadyActive =
    existing?.reason === 'manual' &&
    existing.mode === 'translation' &&
    existing.ticksRemaining > 1;

  requestStillness(world, {
    entityId,
    mode: 'translation',
    reason: 'manual',
    ticksRemaining: ticks,
    requestedBy: null,
  });

  const movement = world.movements.get(entityId);
  if (movement && movement.type === 'socialNav') {
    movement.intention = 'holdStill';
    movement.intentionTicksLeft = Math.max(1, ticks);
    movement.speed = 0;
    movement.smoothSpeed = 0;
    delete movement.goal;
  }

  if (!alreadyActive) {
    world.events.push({
      type: 'peaceCryComplianceHalt',
      tick: world.tick,
      entityId,
      pos: position,
      rankKey: rankKeyForEntity(world, entityId),
    });
  }
}

export class PeaceCrySystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    world.audiblePings = [];
    const strictCompliance = world.config.strictPeaceCryComplianceEnabled;
    const ids = getSortedEntityIds(world);
    if (!world.config.peaceCryEnabled) {
      if (strictCompliance) {
        for (const id of ids) {
          const rank = world.ranks.get(id);
          const transform = world.transforms.get(id);
          if (
            rank?.rank !== Rank.Woman ||
            !transform ||
            !isEntityOutside(world, id) ||
            !isMoving(world, id)
          ) {
            continue;
          }
          const eye = getEyeWorldPosition(world, id);
          requestComplianceStillness(world, id, eye ?? transform.position);
        }
      }
      return;
    }

    for (const id of ids) {
      const rank = world.ranks.get(id);
      const peaceCry = world.peaceCry.get(id);
      const transform = world.transforms.get(id);
      if (!rank || rank.rank !== Rank.Woman || !peaceCry || !transform) {
        continue;
      }
      if (!isEntityOutside(world, id)) {
        continue;
      }

      if (!isMoving(world, id)) {
        continue;
      }

      if (!peaceCry.enabled) {
        if (strictCompliance) {
          const eye = getEyeWorldPosition(world, id);
          requestComplianceStillness(world, id, eye ?? transform.position);
        }
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
        emitterRankKey: rankKeyForEntity(world, id),
      });
      peaceCry.lastEmitTick = world.tick;
    }
  }
}
