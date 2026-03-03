import { isEntityOutside } from '../core/housing/dwelling';
import { houseDoorTargetForHouse } from '../core/housing/shelterPolicy';
import { rankKeyForEntity } from '../core/rankKey';
import { requestStillness } from '../core/stillness';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

const CURFEW_EVENT_COOLDOWN_TICKS = 120;

function maybeApplyCurfewStillness(world: World, entityId: number): void {
  const stillnessTicks = Math.max(1, Math.round(world.config.rainCurfewStillnessTicks));
  requestStillness(world, {
    entityId,
    mode: 'translation',
    reason: 'waitForBearing',
    ticksRemaining: stillnessTicks,
    requestedBy: null,
  });

  const movement = world.movements.get(entityId);
  if (movement && movement.type === 'socialNav') {
    movement.intention = 'holdStill';
    movement.intentionTicksLeft = Math.max(movement.intentionTicksLeft, stillnessTicks);
    movement.speed = 0;
    movement.smoothSpeed = 0;
    delete movement.goal;
  }

  const lastTick = world.rainCurfewLastTick.get(entityId) ?? Number.NEGATIVE_INFINITY;
  if (world.tick - lastTick < CURFEW_EVENT_COOLDOWN_TICKS) {
    return;
  }
  const transform = world.transforms.get(entityId);
  if (!transform) {
    return;
  }
  world.events.push({
    type: 'peaceCryComplianceHalt',
    tick: world.tick,
    entityId,
    pos: transform.position,
    rankKey: rankKeyForEntity(world, entityId),
  });
  world.rainCurfewLastTick.set(entityId, world.tick);
}

function steerTowardShelter(world: World, entityId: number): void {
  const movement = world.movements.get(entityId);
  if (!movement || movement.type !== 'socialNav') {
    return;
  }
  if (movement.intention === 'holdStill') {
    return;
  }

  const visibleShelter = world.visibleShelterTargets.get(entityId);
  if (visibleShelter) {
    movement.intention = 'seekShelter';
    movement.intentionTicksLeft = Math.max(1, Math.round(movement.intentionMinTicks));
    movement.goal = {
      type: 'point',
      targetId: visibleShelter.houseId,
      x: visibleShelter.midpoint.x,
      y: visibleShelter.midpoint.y,
      doorSide: visibleShelter.side,
    };
    return;
  }

  const bond = world.bonds.get(entityId);
  if (bond?.homeHouseId === null || bond?.homeHouseId === undefined) {
    return;
  }
  if (!world.houses.has(bond.homeHouseId)) {
    return;
  }
  const transform = world.transforms.get(entityId);
  if (!transform) {
    return;
  }
  const target = houseDoorTargetForHouse(world, entityId, bond.homeHouseId, transform.position);
  if (!target) {
    return;
  }
  movement.intention = 'seekHome';
  movement.intentionTicksLeft = Math.max(1, Math.round(movement.intentionMinTicks));
  movement.goal = {
    type: 'point',
    targetId: target.houseId,
    x: target.midpoint.x,
    y: target.midpoint.y,
    doorSide: target.side,
  };
}

export class CivicOrderSystem implements System {
  update(world: World): void {
    if (!world.config.rainCurfewEnabled || !world.config.rainEnabled || !world.weather.isRaining) {
      world.rainCurfewOutsideTicks.clear();
      return;
    }

    const graceTicks = Math.max(1, Math.round(world.config.rainCurfewOutsideGraceTicks));
    const seenSegments = new Set<number>();
    const ids = getSortedEntityIds(world);
    for (const id of ids) {
      if (world.staticObstacles.has(id)) {
        continue;
      }
      const shape = world.shapes.get(id);
      if (!shape || shape.kind !== 'segment') {
        continue;
      }
      seenSegments.add(id);

      if (!isEntityOutside(world, id)) {
        world.rainCurfewOutsideTicks.delete(id);
        continue;
      }

      steerTowardShelter(world, id);
      const ticksOutside = (world.rainCurfewOutsideTicks.get(id) ?? 0) + 1;
      world.rainCurfewOutsideTicks.set(id, ticksOutside);

      if (ticksOutside < graceTicks) {
        continue;
      }
      maybeApplyCurfewStillness(world, id);
    }

    for (const entityId of [...world.rainCurfewOutsideTicks.keys()]) {
      if (seenSegments.has(entityId)) {
        continue;
      }
      world.rainCurfewOutsideTicks.delete(entityId);
      world.rainCurfewLastTick.delete(entityId);
    }
  }
}
