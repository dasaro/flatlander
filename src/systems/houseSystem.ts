import type { EntityId, HouseComponent } from '../core/components';
import { doorPoseWorld, houseCentroidWorld } from '../core/housing/houseFactory';
import { Rank } from '../core/rank';
import { requestStillness } from '../core/stillness';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { angleToVector, clamp, dot, normalize, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const DOOR_ENTER_SPEED = 12;
const DOOR_ENTER_ANGLE_DEG = 72;
const MIN_INDOOR_TICKS = 120;
const COOLDOWN_TICKS_AFTER_EXIT = 160;
const PERIODIC_VISIT_TICKS = 720;
const LOW_HP_SHELTER_THRESHOLD = 0.55;
const HOUSE_REPAIR_PER_TICK = 0.08;

function isPerson(world: World, entityId: EntityId): boolean {
  return !world.staticObstacles.has(entityId);
}

function preferredDoorSide(world: World, entityId: EntityId): 'east' | 'west' {
  const rank = world.ranks.get(entityId);
  // Part I §2: women use the east door; men use the west door.
  if (rank?.rank === Rank.Woman) {
    return 'east';
  }
  return 'west';
}

function movementSpeed(world: World, entityId: EntityId): number {
  const movement = world.movements.get(entityId);
  if (!movement) {
    return 0;
  }
  if (movement.type === 'straightDrift') {
    return Math.hypot(movement.vx, movement.vy);
  }
  return Math.max(0, movement.speed);
}

function movementForward(world: World, entityId: EntityId): Vec2 {
  const movement = world.movements.get(entityId);
  if (!movement) {
    const transform = world.transforms.get(entityId);
    return transform ? angleToVector(transform.rotation) : { x: 1, y: 0 };
  }
  if (movement.type === 'straightDrift') {
    const speed = Math.hypot(movement.vx, movement.vy);
    if (speed > 1e-6) {
      return {
        x: movement.vx / speed,
        y: movement.vy / speed,
      };
    }
    const transform = world.transforms.get(entityId);
    return transform ? angleToVector(transform.rotation) : { x: 1, y: 0 };
  }
  return angleToVector(movement.heading);
}

function shouldSeekShelter(world: World, entityId: EntityId): boolean {
  const dwelling = world.dwellings.get(entityId);
  if (!dwelling || dwelling.state !== 'outside' || dwelling.cooldownTicks > 0) {
    return false;
  }

  const durability = world.durability.get(entityId);
  const hpRatio =
    durability && durability.maxHp > 0 ? clamp(durability.hp / durability.maxHp, 0, 1) : 1;
  if (hpRatio <= LOW_HP_SHELTER_THRESHOLD) {
    return true;
  }

  return (world.tick + entityId) % PERIODIC_VISIT_TICKS === 0;
}

function hasHouseCapacity(world: World, houseId: EntityId, house: HouseComponent): boolean {
  if (house.indoorCapacity === null || house.indoorCapacity === undefined) {
    return true;
  }
  const occupants = world.houseOccupants.get(houseId);
  return (occupants?.size ?? 0) < house.indoorCapacity;
}

function nearestHouseForDoor(
  world: World,
  side: 'east' | 'west',
  position: Vec2,
): { houseId: EntityId; house: HouseComponent; distance: number } | null {
  const houseIds = [...world.houses.keys()].sort((a, b) => a - b);
  let best: { houseId: EntityId; house: HouseComponent; distance: number } | null = null;

  for (const houseId of houseIds) {
    const house = world.houses.get(houseId);
    const transform = world.transforms.get(houseId);
    if (!house || !transform || !hasHouseCapacity(world, houseId, house)) {
      continue;
    }

    const door = side === 'east' ? house.doorEast : house.doorWest;
    const doorWorld = doorPoseWorld(transform, door).midpoint;
    const distance = Math.hypot(position.x - doorWorld.x, position.y - doorWorld.y);

    if (
      best === null ||
      distance < best.distance ||
      (distance === best.distance && houseId < best.houseId)
    ) {
      best = { houseId, house, distance };
    }
  }

  return best;
}

function enteringDoorPose(
  world: World,
  houseId: EntityId,
  house: HouseComponent,
  side: 'east' | 'west',
): { midpoint: Vec2; normalInward: Vec2; enterRadius: number } | null {
  const transform = world.transforms.get(houseId);
  if (!transform) {
    return null;
  }

  const door = side === 'east' ? house.doorEast : house.doorWest;
  const pose = doorPoseWorld(transform, door);
  return {
    midpoint: pose.midpoint,
    normalInward: pose.normalInward,
    enterRadius: Math.max(1, house.doorEnterRadius * door.sizeFactor),
  };
}

function setDwellingOutside(
  world: World,
  personId: EntityId,
  cooldownTicks: number,
): void {
  const dwelling = world.dwellings.get(personId);
  if (!dwelling) {
    return;
  }

  const previousHouseId = dwelling.houseId;
  if (previousHouseId !== null && previousHouseId !== undefined) {
    world.houseOccupants.get(previousHouseId)?.delete(personId);
  }

  dwelling.state = 'outside';
  dwelling.houseId = null;
  dwelling.ticksInside = 0;
  dwelling.cooldownTicks = Math.max(0, Math.round(cooldownTicks));
}

function enterHouse(world: World, personId: EntityId, houseId: EntityId, house: HouseComponent): void {
  const dwelling = world.dwellings.get(personId);
  const personTransform = world.transforms.get(personId);
  const houseTransform = world.transforms.get(houseId);
  if (!dwelling || !personTransform || !houseTransform) {
    return;
  }

  if (dwelling.houseId !== null && dwelling.houseId !== undefined && dwelling.houseId !== houseId) {
    world.houseOccupants.get(dwelling.houseId)?.delete(personId);
  }

  dwelling.state = 'inside';
  dwelling.houseId = houseId;
  dwelling.ticksInside = 0;
  dwelling.cooldownTicks = 0;

  const occupants = world.houseOccupants.get(houseId) ?? new Set<EntityId>();
  occupants.add(personId);
  world.houseOccupants.set(houseId, occupants);

  personTransform.position = houseCentroidWorld(houseTransform, house);
}

function exitHouse(
  world: World,
  personId: EntityId,
  houseId: EntityId,
  house: HouseComponent,
  side: 'east' | 'west',
): void {
  const dwelling = world.dwellings.get(personId);
  const personTransform = world.transforms.get(personId);
  const shape = world.shapes.get(personId);
  const houseTransform = world.transforms.get(houseId);
  if (!dwelling || !personTransform || !shape || !houseTransform) {
    return;
  }

  const door = side === 'east' ? house.doorEast : house.doorWest;
  const doorWorld = doorPoseWorld(houseTransform, door);
  const offset = Math.max(
    2,
    house.doorEnterRadius * door.sizeFactor + Math.max(2, shape.boundingRadius * 0.5),
  );
  const outward = {
    x: -doorWorld.normalInward.x,
    y: -doorWorld.normalInward.y,
  };
  let x = doorWorld.midpoint.x + outward.x * offset;
  let y = doorWorld.midpoint.y + outward.y * offset;

  if (world.config.topology === 'torus') {
    x = wrap(x, world.config.width);
    y = wrap(y, world.config.height);
  } else {
    x = clamp(x, 0, world.config.width);
    y = clamp(y, 0, world.config.height);
  }

  personTransform.position = { x, y };
  personTransform.rotation = Math.atan2(outward.y, outward.x);
  setDwellingOutside(world, personId, COOLDOWN_TICKS_AFTER_EXIT);
}

function shouldExitHouse(world: World, personId: EntityId, ticksInside: number): boolean {
  const durability = world.durability.get(personId);
  const hpRatio =
    durability && durability.maxHp > 0 ? clamp(durability.hp / durability.maxHp, 0, 1) : 1;
  if (ticksInside >= MIN_INDOOR_TICKS * 3) {
    return true;
  }
  if (hpRatio >= 0.98 && ticksInside >= MIN_INDOOR_TICKS) {
    return true;
  }
  return ticksInside >= MIN_INDOOR_TICKS && (world.tick + personId) % 90 === 0;
}

function repairIndoors(world: World, personId: EntityId): void {
  const durability = world.durability.get(personId);
  if (!durability) {
    return;
  }
  durability.hp = Math.min(durability.maxHp, durability.hp + HOUSE_REPAIR_PER_TICK);
  durability.wear = Math.max(0, durability.wear - HOUSE_REPAIR_PER_TICK * 0.5);
}

function requestIndoorStillness(world: World, entityId: EntityId): void {
  requestStillness(world, {
    entityId,
    mode: 'full',
    reason: 'waitForBearing',
    ticksRemaining: 2,
    requestedBy: null,
  });
}

export class HouseSystem implements System {
  update(world: World): void {
    if (!world.config.housesEnabled || world.houses.size === 0) {
      return;
    }

    const ids = getSortedEntityIds(world);
    const cosEnterAngle = Math.cos((DOOR_ENTER_ANGLE_DEG * Math.PI) / 180);

    for (const id of ids) {
      if (!isPerson(world, id)) {
        continue;
      }

      const dwelling =
        world.dwellings.get(id) ??
        (() => {
          const created = {
            state: 'outside' as const,
            houseId: null,
            ticksInside: 0,
            cooldownTicks: 0,
          };
          world.dwellings.set(id, created);
          return created;
        })();
      const shape = world.shapes.get(id);
      const transform = world.transforms.get(id);
      if (!shape || !transform) {
        continue;
      }

      if (dwelling.state === 'inside' && dwelling.houseId !== null) {
        const house = world.houses.get(dwelling.houseId);
        if (!house) {
          setDwellingOutside(world, id, COOLDOWN_TICKS_AFTER_EXIT);
          continue;
        }

        dwelling.ticksInside += 1;
        requestIndoorStillness(world, id);
        repairIndoors(world, id);

        const occupants = world.houseOccupants.get(dwelling.houseId) ?? new Set<EntityId>();
        occupants.add(id);
        world.houseOccupants.set(dwelling.houseId, occupants);

        if (shouldExitHouse(world, id, dwelling.ticksInside)) {
          const side = preferredDoorSide(world, id);
          exitHouse(world, id, dwelling.houseId, house, side);
        }
        continue;
      }

      if (dwelling.cooldownTicks > 0) {
        dwelling.cooldownTicks -= 1;
      }

      if (!shouldSeekShelter(world, id)) {
        continue;
      }

      const side = preferredDoorSide(world, id);
      const probe = transform.position;
      const nearest = nearestHouseForDoor(world, side, probe);
      if (!nearest) {
        continue;
      }

      const door = enteringDoorPose(world, nearest.houseId, nearest.house, side);
      if (!door) {
        continue;
      }

      if (nearest.distance > door.enterRadius) {
        continue;
      }

      if (movementSpeed(world, id) > DOOR_ENTER_SPEED) {
        continue;
      }

      const forward = movementForward(world, id);
      if (dot(normalize(forward), door.normalInward) < cosEnterAngle) {
        continue;
      }

      enterHouse(world, id, nearest.houseId, nearest.house);
    }
  }
}
