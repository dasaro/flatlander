import type { EntityId } from '../components';
import type { World } from '../world';

export function isEntityOutside(world: World, entityId: EntityId): boolean {
  if (world.neoTherapy.get(entityId)?.enrolled) {
    return false;
  }
  const dwelling = world.dwellings.get(entityId);
  return !dwelling || dwelling.state === 'outside';
}

export function isEntityInside(world: World, entityId: EntityId): boolean {
  return !isEntityOutside(world, entityId);
}

export function sortedHouseOccupants(world: World, houseId: EntityId): EntityId[] {
  const occupants = world.houseOccupants.get(houseId);
  if (!occupants || occupants.size === 0) {
    return [];
  }
  return [...occupants].sort((a, b) => a - b);
}

export function shouldCollideEntities(world: World, aId: EntityId, bId: EntityId): boolean {
  const aDwelling = world.dwellings.get(aId);
  if (aDwelling && world.houses.has(bId)) {
    const transitExitingHouse =
      aDwelling.transit?.phase === 'exiting' &&
      aDwelling.transit.houseId === bId &&
      aDwelling.transit.ticksLeft > 0;
    const temporaryIgnore =
      aDwelling.ignoreHouseCollisionHouseId === bId && aDwelling.ignoreHouseCollisionTicks > 0;
    if (transitExitingHouse || temporaryIgnore) {
      return false;
    }
  }

  const bDwelling = world.dwellings.get(bId);
  if (bDwelling && world.houses.has(aId)) {
    const transitExitingHouse =
      bDwelling.transit?.phase === 'exiting' &&
      bDwelling.transit.houseId === aId &&
      bDwelling.transit.ticksLeft > 0;
    const temporaryIgnore =
      bDwelling.ignoreHouseCollisionHouseId === aId && bDwelling.ignoreHouseCollisionTicks > 0;
    if (transitExitingHouse || temporaryIgnore) {
      return false;
    }
  }

  return true;
}
