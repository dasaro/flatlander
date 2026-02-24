import type { EntityId } from '../components';
import type { World } from '../world';

export function isEntityOutside(world: World, entityId: EntityId): boolean {
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
