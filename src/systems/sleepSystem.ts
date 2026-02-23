import type { MovementComponent } from '../core/components';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

function movementSpeed(world: World, id: number, movement: MovementComponent): number {
  const southVy = world.southDrifts.get(id)?.vy ?? 0;
  if (movement.type === 'straightDrift') {
    return Math.hypot(movement.vx, movement.vy + southVy);
  }
  return Math.hypot(movement.speed, southVy);
}

export class SleepSystem implements System {
  update(world: World): void {
    if (!world.config.sleepEnabled) {
      world.sleep.clear();
      return;
    }

    const ids = getSortedEntityIds(world);
    const speedEps = Math.max(0, world.config.sleepSpeedEps);
    const correctionEps = Math.max(0, world.config.sleepCorrectionEps);
    const sleepAfterTicks = Math.max(1, Math.round(world.config.sleepAfterTicks));
    const wakeOnImpactSpeed = Math.max(0, world.config.wakeOnImpactSpeed);

    const wakeIds = new Set<number>();
    for (const manifold of world.manifolds) {
      if (manifold.closingSpeed > wakeOnImpactSpeed) {
        wakeIds.add(manifold.aId);
        wakeIds.add(manifold.bId);
      }
    }

    for (const id of ids) {
      if (world.staticObstacles.has(id)) {
        world.sleep.delete(id);
        continue;
      }

      const movement = world.movements.get(id);
      if (!movement) {
        world.sleep.delete(id);
        continue;
      }

      const correction = world.lastCorrections.get(id) ?? 0;
      const speed = movementSpeed(world, id, movement);
      const sleeping = world.sleep.get(id) ?? { asleep: false, stillTicks: 0 };

      if (wakeIds.has(id)) {
        sleeping.asleep = false;
        sleeping.stillTicks = 0;
        world.sleep.set(id, sleeping);
        continue;
      }

      if (speed <= speedEps && correction <= correctionEps) {
        sleeping.stillTicks += 1;
        if (sleeping.stillTicks >= sleepAfterTicks) {
          sleeping.asleep = true;
        }
      } else {
        sleeping.stillTicks = 0;
        sleeping.asleep = false;
      }

      world.sleep.set(id, sleeping);
    }

    for (const id of [...world.sleep.keys()]) {
      if (!world.entities.has(id)) {
        world.sleep.delete(id);
      }
    }
  }
}
