import { getLineagePathToRoot } from '../core/genealogy';
import type { World } from '../core/world';
import type { System } from './system';

export class CleanupSystem implements System {
  update(world: World): void {
    const toRemove = [...world.pendingDeaths].sort((a, b) => a - b);
    world.deathsThisTick = toRemove.length;

    for (const id of toRemove) {
      const lineagePath = getLineagePathToRoot(world, id);
      for (const ancestorId of lineagePath) {
        if (ancestorId === id) {
          continue;
        }
        const legacy = world.legacy.get(ancestorId);
        if (legacy) {
          legacy.descendantsAlive = Math.max(0, legacy.descendantsAlive - 1);
        }
      }

      world.entities.delete(id);
      world.transforms.delete(id);
      world.movements.delete(id);
      world.shapes.delete(id);
      world.eyes.delete(id);
      world.ranks.delete(id);
      world.southDrifts.delete(id);
      world.staticObstacles.delete(id);
      const wasHouse = world.houses.has(id);
      world.houses.delete(id);
      world.dwellings.delete(id);
      if (wasHouse) {
        world.houseOccupants.delete(id);
      }
      for (const occupants of world.houseOccupants.values()) {
        occupants.delete(id);
      }
      world.vision.delete(id);
      world.visionHits.delete(id);
      world.perceptions.delete(id);
      world.voices.delete(id);
      world.hearingHits.delete(id);
      world.peaceCry.delete(id);
      world.feeling.delete(id);
      world.knowledge.delete(id);
      world.ages.delete(id);
      world.fertility.delete(id);
      world.pregnancies.delete(id);
      world.neoTherapy.delete(id);
      world.bonds.delete(id);
      world.names.delete(id);
      world.combatStats.delete(id);
      world.durability.delete(id);
      world.femaleStatus.delete(id);
      world.sway.delete(id);
      world.stillness.delete(id);
      world.sleep.delete(id);
      world.intelligence.delete(id);
      world.brainAngles.delete(id);
      world.irregularity.delete(id);
      world.handshakeCounts.delete(id);
      world.geometries.delete(id);
      world.lastCorrections.delete(id);
      world.houseContactStreaks.delete(id);
      world.houseApproachDebug.delete(id);
    }

    if (toRemove.length > 0 && world.bonds.size > 0) {
      const removed = new Set(toRemove);
      for (const [id, bond] of world.bonds) {
        if (removed.has(id)) {
          continue;
        }
        if (bond.spouseId !== null && removed.has(bond.spouseId)) {
          bond.spouseId = null;
        }
        if (bond.homeHouseId !== null && removed.has(bond.homeHouseId)) {
          bond.homeHouseId = null;
        }
      }
    }

    if (toRemove.length > 0 && world.stabPressure.size > 0) {
      const removed = new Set(toRemove);
      for (const key of [...world.stabPressure.keys()]) {
        const parts = key.split('->');
        const attacker = Number(parts[0]);
        const victim = Number(parts[1]);
        if (removed.has(attacker) || removed.has(victim)) {
          world.stabPressure.delete(key);
        }
      }
    }

    world.pendingDeaths.clear();
  }
}
