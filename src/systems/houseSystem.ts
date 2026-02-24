import type { EntityId, HouseComponent, SocialNavMovement } from '../core/components';
import { isEntityOutside } from '../core/housing/dwelling';
import {
  hasHouseCapacity,
  preferredDoorSide,
  shouldSeekShelter,
} from '../core/housing/shelterPolicy';
import { doorPoseWorld, houseCentroidWorld } from '../core/housing/houseFactory';
import { requestStillness } from '../core/stillness';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const DOOR_ENTER_SPEED = 12;
const DOOR_CONTACT_EPSILON = 2.5;
const MIN_INDOOR_TICKS = 120;
const COOLDOWN_TICKS_AFTER_EXIT = 160;
const HOUSE_REPAIR_PER_TICK = 0.08;

interface DoorContact {
  personId: EntityId;
  houseId: EntityId;
  house: HouseComponent;
  contactPoint: Vec2;
  side: 'east' | 'west';
  distanceToDoor: number;
  enterRadius: number;
}

function isPerson(world: World, entityId: EntityId): boolean {
  return !world.staticObstacles.has(entityId);
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

function setDwellingOutside(world: World, personId: EntityId, cooldownTicks: number): void {
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

  if (
    dwelling.houseId !== null &&
    dwelling.houseId !== undefined &&
    dwelling.houseId !== houseId
  ) {
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
  const hpRatio = durability && durability.maxHp > 0 ? durability.hp / durability.maxHp : 1;
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

function socialNavShelterIntent(
  world: World,
  personId: EntityId,
  houseId: EntityId,
): SocialNavMovement | null {
  const movement = world.movements.get(personId);
  if (!movement || movement.type !== 'socialNav' || movement.intention !== 'seekShelter') {
    return null;
  }

  const goalTargetId = movement.goal?.targetId;
  if (goalTargetId !== undefined && goalTargetId !== houseId) {
    return null;
  }

  const side = preferredDoorSide(world, personId);
  if (movement.goal?.doorSide && movement.goal.doorSide !== side) {
    return null;
  }

  return movement;
}

function shouldAttemptEntry(world: World, personId: EntityId, houseId: EntityId): boolean {
  return shouldSeekShelter(world, personId) || socialNavShelterIntent(world, personId, houseId) !== null;
}

function collectDoorContacts(world: World): DoorContact[] {
  const contacts: DoorContact[] = [];

  for (const manifold of world.manifolds) {
    let personId: EntityId | null = null;
    let houseId: EntityId | null = null;

    if (world.houses.has(manifold.aId) && isPerson(world, manifold.bId)) {
      houseId = manifold.aId;
      personId = manifold.bId;
    } else if (world.houses.has(manifold.bId) && isPerson(world, manifold.aId)) {
      houseId = manifold.bId;
      personId = manifold.aId;
    }

    if (personId === null || houseId === null) {
      continue;
    }

    const house = world.houses.get(houseId);
    const houseTransform = world.transforms.get(houseId);
    if (!house || !houseTransform) {
      continue;
    }

    const side = preferredDoorSide(world, personId);
    const door = side === 'east' ? house.doorEast : house.doorWest;
    const pose = doorPoseWorld(houseTransform, door);
    const enterRadius = Math.max(1, house.doorEnterRadius * door.sizeFactor);
    const distanceToDoor = Math.hypot(
      manifold.contactPoint.x - pose.midpoint.x,
      manifold.contactPoint.y - pose.midpoint.y,
    );
    const personPosition = world.transforms.get(personId)?.position;
    const centroidDistanceToDoor = personPosition
      ? Math.hypot(personPosition.x - pose.midpoint.x, personPosition.y - pose.midpoint.y)
      : Number.POSITIVE_INFINITY;

    if (
      distanceToDoor > enterRadius + DOOR_CONTACT_EPSILON &&
      centroidDistanceToDoor > enterRadius * 1.8
    ) {
      continue;
    }

    contacts.push({
      personId,
      houseId,
      house,
      side,
      contactPoint: manifold.contactPoint,
      distanceToDoor,
      enterRadius,
    });
  }

  return contacts;
}

export class HouseSystem implements System {
  update(world: World): void {
    if (!world.config.housesEnabled || world.houses.size === 0) {
      return;
    }

    const ids = getSortedEntityIds(world);

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
    }

    if (world.manifolds.length === 0) {
      return;
    }

    const enteredThisTick = new Set<EntityId>();
    for (const contact of collectDoorContacts(world)) {
      world.houseDoorContactsThisTick += 1;

      if (enteredThisTick.has(contact.personId)) {
        continue;
      }
      if (!isEntityOutside(world, contact.personId)) {
        continue;
      }

      const dwelling = world.dwellings.get(contact.personId);
      if (!dwelling || dwelling.cooldownTicks > 0) {
        continue;
      }
      if (!hasHouseCapacity(world, contact.houseId, contact.house)) {
        continue;
      }
      if (!shouldAttemptEntry(world, contact.personId, contact.houseId)) {
        continue;
      }
      if (movementSpeed(world, contact.personId) > DOOR_ENTER_SPEED) {
        continue;
      }

      enterHouse(world, contact.personId, contact.houseId, contact.house);
      enteredThisTick.add(contact.personId);
      world.houseEntriesThisTick += 1;
    }
  }
}
