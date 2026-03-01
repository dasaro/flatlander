import type { EntityId, HouseComponent } from '../components';
import { Rank } from '../rank';
import type { World } from '../world';
import { doorPoseWorld } from './houseFactory';
import type { Vec2 } from '../../geometry/vector';

export const LOW_HP_SHELTER_THRESHOLD = 0.55;
export const LOW_HP_HOME_RETURN_THRESHOLD = 0.7;

export interface HouseDoorTarget {
  houseId: EntityId;
  house: HouseComponent;
  side: 'east' | 'west';
  midpoint: Vec2;
  normalInward: Vec2;
  enterRadius: number;
  distance: number;
}

export function preferredDoorSide(world: World, entityId: EntityId): 'east' | 'west' {
  const rank = world.ranks.get(entityId);
  // Flatland Part I §2: women use the east door; men use the west door.
  if (rank?.rank === Rank.Woman) {
    return 'east';
  }
  return 'west';
}

export function hasHouseCapacity(world: World, houseId: EntityId, house: HouseComponent): boolean {
  if (house.indoorCapacity === null || house.indoorCapacity === undefined) {
    return true;
  }
  const occupants = world.houseOccupants.get(houseId);
  return (occupants?.size ?? 0) < house.indoorCapacity;
}

export function healthRatio(world: World, entityId: EntityId): number {
  const durability = world.durability.get(entityId);
  if (!durability || durability.maxHp <= 0) {
    return 1;
  }
  const ratio = durability.hp / durability.maxHp;
  return Math.max(0, Math.min(1, ratio));
}

export function shouldSeekShelter(world: World, entityId: EntityId): boolean {
  const dwelling = world.dwellings.get(entityId);
  if (dwelling && (dwelling.state !== 'outside' || dwelling.cooldownTicks > 0)) {
    return false;
  }

  const rainMotivation =
    world.config.housesEnabled && world.config.rainEnabled && world.weather.isRaining;
  if (rainMotivation) {
    return true;
  }

  if (world.config.crowdStressEnabled && world.config.housesEnabled && world.houses.size > 0) {
    let population = 0;
    for (const id of world.entities) {
      if (!world.staticObstacles.has(id)) {
        population += 1;
      }
    }
    const comfort = Math.max(1, world.config.crowdComfortPopulation);
    const overload = (population - comfort) / comfort;
    // Flatland Part I §2 / §4 / §12: crowding raises collision danger; indoors
    // shelter acts as a deterministic pressure-release behavior in dense phases.
    if (overload >= 0.35) {
      return true;
    }
  }

  return healthRatio(world, entityId) <= LOW_HP_SHELTER_THRESHOLD;
}

export function nearestHouseDoorTarget(
  world: World,
  entityId: EntityId,
  origin: Vec2,
): HouseDoorTarget | null {
  const side = preferredDoorSide(world, entityId);
  const houseIds = [...world.houses.keys()].sort((a, b) => a - b);

  let best: HouseDoorTarget | null = null;
  for (const houseId of houseIds) {
    const house = world.houses.get(houseId);
    const transform = world.transforms.get(houseId);
    if (!house || !transform || !hasHouseCapacity(world, houseId, house)) {
      continue;
    }

    const door = side === 'east' ? house.doorEast : house.doorWest;
    const pose = doorPoseWorld(transform, door);
    const distance = Math.hypot(origin.x - pose.midpoint.x, origin.y - pose.midpoint.y);
    const enterRadius = Math.max(1, house.doorEnterRadius * door.sizeFactor);

    const candidate: HouseDoorTarget = {
      houseId,
      house,
      side,
      midpoint: pose.midpoint,
      normalInward: pose.normalInward,
      enterRadius,
      distance,
    };

    if (
      best === null ||
      candidate.distance < best.distance ||
      (candidate.distance === best.distance && candidate.houseId < best.houseId)
    ) {
      best = candidate;
    }
  }

  return best;
}

export function houseDoorTargetForHouse(
  world: World,
  entityId: EntityId,
  houseId: EntityId,
  origin: Vec2,
): HouseDoorTarget | null {
  const house = world.houses.get(houseId);
  const transform = world.transforms.get(houseId);
  if (!house || !transform || !hasHouseCapacity(world, houseId, house)) {
    return null;
  }

  const side = preferredDoorSide(world, entityId);
  const door = side === 'east' ? house.doorEast : house.doorWest;
  const pose = doorPoseWorld(transform, door);
  const distance = Math.hypot(origin.x - pose.midpoint.x, origin.y - pose.midpoint.y);
  const enterRadius = Math.max(1, house.doorEnterRadius * door.sizeFactor);

  return {
    houseId,
    house,
    side,
    midpoint: pose.midpoint,
    normalInward: pose.normalInward,
    enterRadius,
    distance,
  };
}
