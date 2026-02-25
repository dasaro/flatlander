import { hashNoise } from '../core/behaviors/hashNoise';
import type { EntityId, SocialIntention, SocialNavMovement } from '../core/components';
import { isEntityOutside } from '../core/housing/dwelling';
import {
  houseDoorTargetForHouse,
  LOW_HP_HOME_RETURN_THRESHOLD,
  nearestHouseDoorTarget,
  shouldSeekShelter,
} from '../core/housing/shelterPolicy';
import { Rank } from '../core/rank';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

function rankWeight(rank: Rank): number {
  switch (rank) {
    case Rank.Woman:
      return 1;
    case Rank.Irregular:
      return 1.2;
    case Rank.Triangle:
      return 2;
    case Rank.Gentleman:
      return 3;
    case Rank.Noble:
      return 4;
    case Rank.NearCircle:
      return 5;
    case Rank.Priest:
      return 6;
    default:
      return 0;
  }
}

interface DirectionCandidate {
  id: EntityId;
  distance: number;
  direction: Vec2;
}

function sightDirectionCandidate(world: World, entityId: EntityId): DirectionCandidate | null {
  const hit = world.visionHits.get(entityId);
  if (!hit) {
    return null;
  }
  return {
    id: hit.hitId,
    distance: hit.distance ?? Number.POSITIVE_INFINITY,
    direction: hit.direction,
  };
}

function seenEntityId(world: World, entityId: EntityId): EntityId | null {
  const hit = world.visionHits.get(entityId);
  if (
    !hit ||
    hit.kind !== 'entity' ||
    !world.entities.has(hit.hitId) ||
    world.staticObstacles.has(hit.hitId)
  ) {
    return null;
  }
  return hit.hitId;
}

function higherRankFromPerception(world: World, entityId: EntityId, seenId: EntityId | null): DirectionCandidate | null {
  const rank = world.ranks.get(entityId);
  if (!rank) {
    return null;
  }

  const ownWeight = rankWeight(rank.rank);
  const sightCandidate = sightDirectionCandidate(world, entityId);
  if (seenId !== null && sightCandidate) {
    const seenRank = world.ranks.get(seenId);
    if (seenRank && rankWeight(seenRank.rank) > ownWeight) {
      return {
        id: seenId,
        distance: sightCandidate.distance,
        direction: sightCandidate.direction,
      };
    }
  }

  return null;
}

function mateFromPerception(world: World, entityId: EntityId, seenId: EntityId | null): DirectionCandidate | null {
  if (seenId === null) {
    return null;
  }

  const selfShape = world.shapes.get(entityId);
  if (!selfShape || selfShape.kind !== 'segment') {
    return null;
  }

  const fertility = world.fertility.get(entityId);
  const age = world.ages.get(entityId);
  if (!fertility || !fertility.enabled || world.pregnancies.has(entityId)) {
    return null;
  }

  if ((age?.ticksAlive ?? 0) < fertility.maturityTicks) {
    return null;
  }
  if (world.tick - fertility.lastBirthTick < fertility.cooldownTicks) {
    return null;
  }

  const seenShape = world.shapes.get(seenId);
  if (!seenShape || !(seenShape.kind === 'polygon' || seenShape.kind === 'circle')) {
    return null;
  }

  const sightCandidate = sightDirectionCandidate(world, entityId);
  if (!sightCandidate || sightCandidate.id !== seenId) {
    return null;
  }

  if (sightCandidate.distance > Math.max(0, world.config.matingRadius)) {
    return null;
  }

  return sightCandidate;
}

function unknownFromPerception(world: World, entityId: EntityId, seenId: EntityId | null): DirectionCandidate | null {
  if (seenId === null) {
    return null;
  }

  const knowledge = world.knowledge.get(entityId);
  const sightCandidate = sightDirectionCandidate(world, entityId);
  if (!knowledge || !sightCandidate || sightCandidate.id !== seenId) {
    return null;
  }

  if (knowledge.known.has(seenId)) {
    return null;
  }

  if (sightCandidate.distance > Math.max(0, world.config.introductionRadius)) {
    return null;
  }

  return sightCandidate;
}

function cautionFactor(world: World, entityId: EntityId): number {
  const shape = world.shapes.get(entityId);
  const rank = world.ranks.get(entityId);
  if (!shape || !rank) {
    return 0.5;
  }

  if (shape.kind === 'segment') {
    return 1;
  }

  switch (rank.rank) {
    case Rank.Priest:
      return 0.85;
    case Rank.NearCircle:
      return 0.8;
    case Rank.Noble:
      return 0.75;
    case Rank.Gentleman:
      return 0.65;
    case Rank.Triangle:
      return 0.45;
    case Rank.Irregular:
      return 0.35;
    default:
      return 0.5;
  }
}

function chooseIntention(
  movement: SocialNavMovement,
  desireAvoid: number,
  desireHome: number,
  desireShelter: number,
  desireYield: number,
  desireMate: number,
  desireFeel: number,
): SocialIntention {
  if (desireAvoid >= Math.max(desireHome, desireShelter, desireYield, desireMate, desireFeel, 0.62)) {
    return 'avoid';
  }
  if (desireHome >= Math.max(desireShelter, desireYield, desireMate, desireFeel, 0.25)) {
    return 'seekHome';
  }
  if (desireShelter >= Math.max(desireYield, desireMate, desireFeel, 0.2)) {
    return 'seekShelter';
  }
  if (desireYield >= Math.max(desireMate, desireFeel, 0.35)) {
    return 'yield';
  }
  if (desireMate >= Math.max(desireFeel, 0.25)) {
    return 'approachMate';
  }
  if (desireFeel >= 0.2) {
    return 'approachForFeeling';
  }
  return movement.intention === 'roam' ? 'roam' : 'roam';
}

function setGoalDirection(movement: SocialNavMovement, direction: Vec2): void {
  movement.goal = {
    type: 'direction',
    heading: Math.atan2(direction.y, direction.x),
  };
}

function setGoalTarget(movement: SocialNavMovement, targetId: EntityId, point: Vec2): void {
  movement.goal = {
    type: 'point',
    x: point.x,
    y: point.y,
    targetId,
  };
}

function trackHousingIntentionCounts(world: World, movement: SocialNavMovement): void {
  if (movement.intention === 'seekShelter') {
    world.seekShelterIntentCount += 1;
  } else if (movement.intention === 'seekHome') {
    world.seekHomeIntentCount += 1;
  }
}

export class SocialNavMindSystem implements System {
  update(world: World): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      const movement = world.movements.get(id);
      if (!movement || movement.type !== 'socialNav' || world.staticObstacles.has(id)) {
        continue;
      }
      if (!isEntityOutside(world, id)) {
        continue;
      }
      const transform = world.transforms.get(id);
      if (!transform) {
        continue;
      }
      const stillness = world.stillness.get(id);
      if (stillness) {
        movement.intention = 'holdStill';
        movement.intentionTicksLeft = Math.max(1, stillness.ticksRemaining);
        delete movement.goal;
        continue;
      }
      if (world.sleep.get(id)?.asleep) {
        movement.intentionTicksLeft = Math.max(0, movement.intentionTicksLeft - 1);
        continue;
      }

      const needDecision = movement.intentionTicksLeft <= 0;
      const visionHit = world.visionHits.get(id);
      const sightHazardDistance = visionHit?.distance ?? Number.POSITIVE_INFINITY;
      const contactDistance = world.collisions.some((pair) => pair.a === id || pair.b === id)
        ? 0
        : Number.POSITIVE_INFINITY;
      const hazardDistance = Math.min(sightHazardDistance, contactDistance);
      const emergencyAvoid = hazardDistance <= Math.max(4, movement.maxSpeed * 0.45);

      const hazardDirection: Vec2 | null = visionHit?.direction ?? null;

      if (!needDecision && !emergencyAvoid) {
        movement.intentionTicksLeft -= 1;
        trackHousingIntentionCounts(world, movement);
        continue;
      }

      const seenId = seenEntityId(world, id);
      const higher = higherRankFromPerception(world, id, seenId);
      const mate = mateFromPerception(world, id, seenId);
      const unknown = unknownFromPerception(world, id, seenId);
      const bond = world.bonds.get(id);
      const homeDoorTarget =
        bond?.homeHouseId !== null &&
        bond?.homeHouseId !== undefined &&
        world.houses.has(bond.homeHouseId)
          ? houseDoorTargetForHouse(world, id, bond.homeHouseId, transform.position)
          : null;
      const shelterTarget = nearestHouseDoorTarget(world, id, transform.position);
      const shelterWanted = shelterTarget !== null && shouldSeekShelter(world, id);
      const durability = world.durability.get(id);
      const hpRatio = durability && durability.maxHp > 0 ? durability.hp / durability.maxHp : 1;
      const periodicHomeReturn = world.tick % 720 < 90;
      const spouseBonded = bond?.spouseId !== null && bond?.spouseId !== undefined;
      const homeWanted =
        homeDoorTarget !== null &&
        (world.weather.isRaining ||
          hpRatio <= LOW_HP_HOME_RETURN_THRESHOLD ||
          periodicHomeReturn ||
          spouseBonded);
      const caution = cautionFactor(world, id);

      const hazardRadius = Math.max(8, movement.maxSpeed * 2.2);
      const desireAvoid =
        hazardDistance === Number.POSITIVE_INFINITY
          ? 0
          : Math.max(0, (hazardRadius - hazardDistance) / hazardRadius) * (0.4 + caution * 0.6);
      const desireYield =
        higher === null ? 0 : Math.max(0, (140 - higher.distance) / 140) * (0.25 + caution * 0.8);
      const desireHome =
        !homeWanted || homeDoorTarget === null
          ? 0
          : world.weather.isRaining
            ? Math.max(0.65, Math.max(0, (240 - homeDoorTarget.distance) / 240))
            : Math.max(0.28, Math.max(0, (240 - homeDoorTarget.distance) / 240));
      const desireShelter =
        !shelterWanted || shelterTarget === null
          ? 0
          : world.weather.isRaining
            ? Math.max(0.58, Math.max(0, (220 - shelterTarget.distance) / 220))
            : Math.max(0.24, Math.max(0, (220 - shelterTarget.distance) / 220));
      const desireMate =
        mate === null
          ? 0
          : Math.max(0, (world.config.matingRadius - mate.distance) / Math.max(1, world.config.matingRadius));
      const desireFeel =
        unknown === null
          ? 0
          : Math.max(
              0,
              (world.config.introductionRadius - unknown.distance) /
                Math.max(1, world.config.introductionRadius),
            );

      movement.intention = chooseIntention(
        movement,
        desireAvoid,
        desireHome,
        desireShelter,
        desireYield,
        desireMate,
        desireFeel,
      );

      if (movement.intention === 'avoid' || movement.intention === 'yield') {
        const direction =
          movement.intention === 'yield'
            ? higher?.direction
            : hazardDirection ?? higher?.direction ?? unknown?.direction;
        if (direction) {
          setGoalDirection(movement, { x: -direction.x, y: -direction.y });
        } else {
          setGoalDirection(movement, {
            x: Math.cos(movement.heading + Math.PI),
            y: Math.sin(movement.heading + Math.PI),
          });
        }
      } else if (movement.intention === 'approachMate' && mate) {
        const mateTransform = world.transforms.get(mate.id);
        if (mateTransform) {
          setGoalTarget(movement, mate.id, mateTransform.position);
        }
      } else if (movement.intention === 'seekShelter' && shelterTarget) {
        movement.goal = {
          type: 'point',
          targetId: shelterTarget.houseId,
          x: shelterTarget.midpoint.x,
          y: shelterTarget.midpoint.y,
          doorSide: shelterTarget.side,
        };
      } else if (movement.intention === 'seekHome' && homeDoorTarget) {
        movement.goal = {
          type: 'point',
          targetId: homeDoorTarget.houseId,
          x: homeDoorTarget.midpoint.x,
          y: homeDoorTarget.midpoint.y,
          doorSide: homeDoorTarget.side,
        };
      } else if (movement.intention === 'approachForFeeling' && unknown) {
        const unknownTransform = world.transforms.get(unknown.id);
        if (unknownTransform) {
          setGoalTarget(movement, unknown.id, unknownTransform.position);
          const feeling = world.feeling.get(id);
          if (feeling && (feeling.state === 'idle' || feeling.state === 'approaching')) {
            feeling.state = 'approaching';
            feeling.partnerId = unknown.id;
          }
        }
      } else {
        const interval = Math.max(1, movement.decisionEveryTicks);
        const bucket = Math.floor(world.tick / interval);
        const noise = hashNoise(world.seed, id, bucket) * 2 - 1;
        const noiseSpan = 0.28 + (1 - caution) * 0.5;
        const roamHeading = normalizeAngle(movement.smoothHeading + noise * noiseSpan);
        movement.goal = {
          type: 'direction',
          heading: roamHeading,
        };
        movement.intention = 'roam';
        const feeling = world.feeling.get(id);
        if (feeling?.state === 'approaching') {
          feeling.state = 'idle';
          feeling.partnerId = null;
          feeling.ticksLeft = 0;
        }
      }

      const durationBucket = Math.floor(world.tick / Math.max(1, movement.decisionEveryTicks));
      const jitter = 0.7 + hashNoise(world.seed + 17, id, durationBucket) * 0.6;
      const baseDuration = Math.max(1, movement.intentionMinTicks);
      movement.intentionTicksLeft = Math.max(1, Math.round(baseDuration * jitter));
      if (emergencyAvoid && movement.intention !== 'avoid') {
        movement.intention = 'avoid';
      }
      trackHousingIntentionCounts(world, movement);
    }
  }
}
