import { rankKeyForEntity } from '../core/rankKey';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp } from '../geometry/vector';
import type { System } from './system';

function markAgeAttritionDeath(world: World, entityId: number): void {
  if (world.pendingDeaths.has(entityId)) {
    return;
  }
  world.pendingDeaths.add(entityId);
  world.deathTypesThisTick.attrition += 1;
  world.deathTypesTotal.attrition += 1;
  const transform = world.transforms.get(entityId);
  if (!transform) {
    return;
  }
  world.events.push({
    type: 'death',
    tick: world.tick,
    entityId,
    pos: transform.position,
    rankKey: rankKeyForEntity(world, entityId),
  });
}

export class AgeDeteriorationSystem implements System {
  update(world: World, dt: number): void {
    if (!world.config.ageWearEnabled) {
      return;
    }

    const startTicks = Math.max(0, Math.round(world.config.ageWearStartTicks));
    const rampTicks = Math.max(1, Math.round(world.config.ageWearRampTicks));
    const wearRate = Math.max(0, world.config.ageWearRate);
    if (wearRate <= 0) {
      return;
    }
    const wearStep = Math.max(0.01, world.config.wearToHpStep);

    for (const id of getSortedEntityIds(world)) {
      if (world.staticObstacles.has(id)) {
        continue;
      }
      const age = world.ages.get(id);
      const durability = world.durability.get(id);
      if (!age || !durability) {
        continue;
      }
      if (age.ticksAlive <= startTicks) {
        continue;
      }
      const ageProgress = clamp((age.ticksAlive - startTicks) / rampTicks, 0, 1);
      const wearDelta = wearRate * ageProgress * dt;
      if (wearDelta <= 0) {
        continue;
      }

      durability.wear += wearDelta;
      if (durability.wear < wearStep) {
        continue;
      }

      const hpLoss = Math.floor(durability.wear / wearStep);
      durability.wear -= hpLoss * wearStep;
      durability.hp -= hpLoss;
      if (durability.hp <= 0) {
        markAgeAttritionDeath(world, id);
      }
    }
  }
}

