import type { MovementComponent } from '../core/components';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

function movementSpeed(world: World, id: number, movement: MovementComponent): number {
  void world;
  void id;
  if (movement.type === 'straightDrift') {
    return Math.hypot(movement.vx, movement.vy);
  }
  return Math.abs(movement.speed);
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

      // Intentional halts are social/protocol states, not passive settling.
      // If we let them accumulate sleep ticks, agents can remain asleep after
      // the protocol ends and never re-deliberate until bumped.
      if (
        world.stillness.has(id) ||
        (movement.type === 'socialNav' && movement.intention === 'holdStill')
      ) {
        sleeping.asleep = false;
        sleeping.stillTicks = 0;
        world.sleep.set(id, sleeping);
        continue;
      }

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
