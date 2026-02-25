import type { EntityId, HouseComponent, SocialNavMovement } from '../core/components';
import { isEntityOutside } from '../core/housing/dwelling';
import {
  LOW_HP_HOME_RETURN_THRESHOLD,
  healthRatio,
  hasHouseCapacity,
  preferredDoorSide,
} from '../core/housing/shelterPolicy';
import { doorPoseWorld, houseCentroidWorld } from '../core/housing/houseFactory';
import type { HouseTransitionReason } from '../core/events';
import { rankKeyForEntity } from '../core/rankKey';
import { requestStillness } from '../core/stillness';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp, normalize, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const DOOR_ENTER_SPEED = 12;
const DOOR_CONTACT_EPSILON = 8;
const DOOR_EXIT_CLEARANCE = 8;
const DOOR_EXIT_PUSH_SPEED = 16;
const EXIT_TRANSIT_TICKS = 14;
const IGNORE_HOUSE_COLLISION_TICKS = 16;
const REENTER_COOLDOWN_TICKS = 120;
const MIN_INDOOR_TICKS = 120;
const COOLDOWN_TICKS_AFTER_EXIT = 160;
const HOUSE_REPAIR_PER_TICK = 0.08;
const STUCK_ABORT_TICKS = 240;
const STUCK_ALERT_TICKS = 400;

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

function applyExitTransitMotion(world: World, entityId: EntityId, dirWorld: Vec2): void {
  const movement = world.movements.get(entityId);
  const transform = world.transforms.get(entityId);
  if (!movement || !transform) {
    return;
  }

  const direction = normalize(dirWorld);
  const heading = Math.atan2(direction.y, direction.x);

  if (movement.type === 'straightDrift') {
    movement.vx = direction.x * DOOR_EXIT_PUSH_SPEED;
    movement.vy = direction.y * DOOR_EXIT_PUSH_SPEED;
  } else {
    movement.heading = heading;
    movement.speed = Math.max(movement.speed, DOOR_EXIT_PUSH_SPEED);
    if (movement.type === 'socialNav') {
      movement.smoothHeading = heading;
      movement.smoothSpeed = Math.max(movement.smoothSpeed, DOOR_EXIT_PUSH_SPEED);
      movement.intention = 'seekHome';
      movement.intentionTicksLeft = Math.max(1, movement.intentionTicksLeft, EXIT_TRANSIT_TICKS);
      movement.goal = {
        type: 'direction',
        heading,
      };
    }
  }

  transform.rotation = heading;
}

function tickDwellingOutdoorState(world: World, entityId: EntityId): void {
  const dwelling = world.dwellings.get(entityId);
  if (!dwelling) {
    return;
  }

  if (dwelling.ignoreHouseCollisionTicks > 0) {
    dwelling.ignoreHouseCollisionTicks -= 1;
    if (dwelling.ignoreHouseCollisionTicks <= 0) {
      dwelling.ignoreHouseCollisionTicks = 0;
      dwelling.ignoreHouseCollisionHouseId = null;
    }
  }

  if (dwelling.reenterCooldownTicks > 0) {
    dwelling.reenterCooldownTicks -= 1;
    if (dwelling.reenterCooldownTicks <= 0) {
      dwelling.reenterCooldownTicks = 0;
      dwelling.reenterHouseId = null;
    }
  }

  if (dwelling.transit?.phase === 'exiting' && dwelling.transit.ticksLeft > 0) {
    applyExitTransitMotion(world, entityId, dwelling.transit.dirWorld);
    dwelling.transit.ticksLeft -= 1;
    if (dwelling.transit.ticksLeft <= 0) {
      dwelling.transit = null;
    }
  }
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
  dwelling.transit = null;
  dwelling.ignoreHouseCollisionHouseId = null;
  dwelling.ignoreHouseCollisionTicks = 0;
  dwelling.reenterHouseId = null;
  dwelling.reenterCooldownTicks = 0;
}

function classifyEnterReason(world: World, personId: EntityId, houseId: EntityId): HouseTransitionReason {
  if (world.weather.isRaining) {
    return 'RainShelter';
  }
  const bond = world.bonds.get(personId);
  if (bond?.homeHouseId === houseId) {
    return 'ReturnHome';
  }
  if (healthRatio(world, personId) <= LOW_HP_HOME_RETURN_THRESHOLD) {
    return 'Healing';
  }
  const movement = world.movements.get(personId);
  if (
    movement?.type === 'socialNav' &&
    movement.intention === 'seekShelter' &&
    world.entities.size > world.config.crowdComfortPopulation
  ) {
    return 'AvoidCrowd';
  }
  return 'Wander';
}

function classifyExitReason(world: World, personId: EntityId): HouseTransitionReason {
  if (world.weather.isRaining) {
    return 'WaitForBearing';
  }
  if (healthRatio(world, personId) < 0.98) {
    return 'Healing';
  }
  return 'Wander';
}

function enterHouse(
  world: World,
  personId: EntityId,
  houseId: EntityId,
  house: HouseComponent,
  side: 'east' | 'west',
  reason: HouseTransitionReason,
): void {
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
  dwelling.transit = null;
  dwelling.ignoreHouseCollisionHouseId = null;
  dwelling.ignoreHouseCollisionTicks = 0;

  const occupants = world.houseOccupants.get(houseId) ?? new Set<EntityId>();
  occupants.add(personId);
  world.houseOccupants.set(houseId, occupants);

  personTransform.position = houseCentroidWorld(houseTransform, house);
  const doorPose = doorPoseWorld(houseTransform, side === 'east' ? house.doorEast : house.doorWest);
  world.events.push({
    type: 'houseEnter',
    tick: world.tick,
    entityId: personId,
    houseId,
    doorSide: side,
    reason,
    pos: doorPose.midpoint,
    entityRankKey: rankKeyForEntity(world, personId),
  });
}

function exitHouse(
  world: World,
  personId: EntityId,
  houseId: EntityId,
  house: HouseComponent,
  side: 'east' | 'west',
  reason: HouseTransitionReason,
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
  const outward = normalize({
    x: -doorWorld.normalInward.x,
    y: -doorWorld.normalInward.y,
  });
  const offset = Math.max(
    2,
    house.doorEnterRadius * door.sizeFactor + Math.max(2, shape.boundingRadius) + DOOR_EXIT_CLEARANCE,
  );
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
  if (dwelling) {
    dwelling.transit = {
      phase: 'exiting',
      houseId,
      ticksLeft: EXIT_TRANSIT_TICKS,
      dirWorld: outward,
    };
    dwelling.ignoreHouseCollisionHouseId = houseId;
    dwelling.ignoreHouseCollisionTicks = IGNORE_HOUSE_COLLISION_TICKS;
    dwelling.reenterHouseId = houseId;
    dwelling.reenterCooldownTicks = REENTER_COOLDOWN_TICKS;
  }
  applyExitTransitMotion(world, personId, outward);
  world.events.push({
    type: 'houseExit',
    tick: world.tick,
    entityId: personId,
    houseId,
    doorSide: side,
    reason,
    pos: doorWorld.midpoint,
    entityRankKey: rankKeyForEntity(world, personId),
  });
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
  if (
    !movement ||
    movement.type !== 'socialNav' ||
    (movement.intention !== 'seekShelter' && movement.intention !== 'seekHome')
  ) {
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

function abortHouseApproach(world: World, personId: EntityId): void {
  const movement = world.movements.get(personId);
  if (!movement || movement.type !== 'socialNav') {
    return;
  }
  movement.intention = 'roam';
  movement.intentionTicksLeft = Math.max(1, Math.round(movement.intentionMinTicks));
  delete movement.goal;
}

function shouldAttemptEntry(world: World, personId: EntityId, houseId: EntityId): boolean {
  const dwelling = world.dwellings.get(personId);
  if (!dwelling) {
    return false;
  }
  if (dwelling.transit !== null) {
    return false;
  }
  if (dwelling.reenterHouseId === houseId && dwelling.reenterCooldownTicks > 0) {
    return false;
  }
  // Flatland Part I §2: doors are canonical portals; reaching the correct
  // doorway at controlled speed is sufficient for entry.
  return true;
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
    if (distanceToDoor > enterRadius + DOOR_CONTACT_EPSILON) {
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
      world.houseContactStreaks.clear();
      world.houseApproachDebug.clear();
      return;
    }

    const ids = getSortedEntityIds(world);
    world.insideCountThisTick = 0;

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
            transit: null,
            ignoreHouseCollisionHouseId: null,
            ignoreHouseCollisionTicks: 0,
            reenterHouseId: null,
            reenterCooldownTicks: 0,
          };
          world.dwellings.set(id, created);
          return created;
        })();

      if (dwelling.state === 'inside' && dwelling.houseId !== null) {
        world.insideCountThisTick += 1;
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
          const reason = classifyExitReason(world, id);
          exitHouse(world, id, dwelling.houseId, house, side, reason);
        }
        continue;
      }

      tickDwellingOutdoorState(world, id);
      if (dwelling.cooldownTicks > 0) {
        dwelling.cooldownTicks -= 1;
      }
    }

    if (world.manifolds.length === 0) {
      world.houseContactStreaks.clear();
      world.houseApproachDebug.clear();
      return;
    }

    const enteredThisTick = new Set<EntityId>();
    const touchedThisTick = new Set<EntityId>();
    for (const contact of collectDoorContacts(world)) {
      world.houseDoorContactsThisTick += 1;
      touchedThisTick.add(contact.personId);

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
      if (dwelling.transit !== null) {
        continue;
      }
      if (dwelling.reenterHouseId === contact.houseId && dwelling.reenterCooldownTicks > 0) {
        continue;
      }
      if (!hasHouseCapacity(world, contact.houseId, contact.house)) {
        continue;
      }
      const intent = socialNavShelterIntent(world, contact.personId, contact.houseId);
      if (!shouldAttemptEntry(world, contact.personId, contact.houseId)) {
        world.houseApproachDebug.delete(contact.personId);
        world.houseContactStreaks.delete(contact.personId);
        continue;
      }
      if (intent) {
        const houseTransform = world.transforms.get(contact.houseId);
        const doorSpec = contact.side === 'east' ? contact.house.doorEast : contact.house.doorWest;
        if (houseTransform) {
          const doorPose = doorPoseWorld(houseTransform, doorSpec);
          world.houseApproachDebug.set(contact.personId, {
            houseId: contact.houseId,
            doorPoint: doorPose.midpoint,
            contactPoint: contact.contactPoint,
            enterRadius: contact.enterRadius,
          });
        }
      }

      if (intent) {
        const previousStreak = world.houseContactStreaks.get(contact.personId);
        const streakTicks =
          previousStreak && previousStreak.houseId === contact.houseId
            ? previousStreak.ticks + 1
            : 1;
        world.houseContactStreaks.set(contact.personId, {
          houseId: contact.houseId,
          ticks: streakTicks,
        });
        if (streakTicks > STUCK_ALERT_TICKS) {
          world.stuckNearHouseCount += 1;
        }
        if (streakTicks > STUCK_ABORT_TICKS) {
          abortHouseApproach(world, contact.personId);
          const dw = world.dwellings.get(contact.personId);
          if (dw) {
            dw.cooldownTicks = Math.max(dw.cooldownTicks, 90);
          }
          world.houseApproachDebug.delete(contact.personId);
          continue;
        }
      } else {
        world.houseContactStreaks.delete(contact.personId);
      }
      if (movementSpeed(world, contact.personId) > DOOR_ENTER_SPEED) {
        continue;
      }

      const reason = classifyEnterReason(world, contact.personId, contact.houseId);
      enterHouse(world, contact.personId, contact.houseId, contact.house, contact.side, reason);
      enteredThisTick.add(contact.personId);
      world.houseContactStreaks.delete(contact.personId);
      world.houseApproachDebug.delete(contact.personId);
      world.houseEntriesThisTick += 1;
    }

    for (const personId of [...world.houseContactStreaks.keys()]) {
      if (touchedThisTick.has(personId)) {
        continue;
      }
      world.houseContactStreaks.delete(personId);
      world.houseApproachDebug.delete(personId);
    }

    let insideTotal = 0;
    for (const dwelling of world.dwellings.values()) {
      if (dwelling.state === 'inside') {
        insideTotal += 1;
      }
    }
    world.insideCountThisTick = insideTotal;
  }
}
