import { hashNoise } from '../core/behaviors/hashNoise';
import type { EntityId, SocialIntention, SocialNavMovement } from '../core/components';
import { Rank } from '../core/rank';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { distance, sub } from '../geometry/vector';
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

function nearestUnknownNeighbor(
  world: World,
  entityId: EntityId,
  ids: EntityId[],
): DirectionCandidate | null {
  const knowledge = world.knowledge.get(entityId);
  const transform = world.transforms.get(entityId);
  if (!knowledge || !transform) {
    return null;
  }

  let best: DirectionCandidate | null = null;
  for (const otherId of ids) {
    if (otherId === entityId || knowledge.known.has(otherId)) {
      continue;
    }

    if (world.staticObstacles.has(otherId)) {
      continue;
    }

    const otherTransform = world.transforms.get(otherId);
    if (!otherTransform) {
      continue;
    }

    const toOther = sub(otherTransform.position, transform.position);
    const d = Math.hypot(toOther.x, toOther.y);
    if (
      best === null ||
      d < best.distance ||
      (d === best.distance && otherId < best.id)
    ) {
      best = {
        id: otherId,
        distance: d,
        direction: d > 0 ? { x: toOther.x / d, y: toOther.y / d } : { x: 1, y: 0 },
      };
    }
  }

  return best;
}

function nearestHigherRank(
  world: World,
  entityId: EntityId,
  ids: EntityId[],
): DirectionCandidate | null {
  const rank = world.ranks.get(entityId);
  const transform = world.transforms.get(entityId);
  if (!rank || !transform) {
    return null;
  }

  const ownWeight = rankWeight(rank.rank);
  let best: DirectionCandidate | null = null;
  for (const otherId of ids) {
    if (otherId === entityId || world.staticObstacles.has(otherId)) {
      continue;
    }

    const otherRank = world.ranks.get(otherId);
    const otherTransform = world.transforms.get(otherId);
    if (!otherRank || !otherTransform || rankWeight(otherRank.rank) <= ownWeight) {
      continue;
    }

    const toOther = sub(otherTransform.position, transform.position);
    const d = Math.hypot(toOther.x, toOther.y);
    if (
      best === null ||
      d < best.distance ||
      (d === best.distance && otherId < best.id)
    ) {
      best = {
        id: otherId,
        distance: d,
        direction: d > 0 ? { x: toOther.x / d, y: toOther.y / d } : { x: 1, y: 0 },
      };
    }
  }

  return best;
}

function nearestMateCandidate(
  world: World,
  entityId: EntityId,
  ids: EntityId[],
): DirectionCandidate | null {
  const transform = world.transforms.get(entityId);
  const shape = world.shapes.get(entityId);
  if (!transform || !shape || shape.kind !== 'segment') {
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

  const radius = Math.max(0, world.config.matingRadius);
  let best: DirectionCandidate | null = null;
  for (const otherId of ids) {
    if (otherId === entityId || world.staticObstacles.has(otherId)) {
      continue;
    }

    const otherShape = world.shapes.get(otherId);
    const otherTransform = world.transforms.get(otherId);
    if (!otherShape || !otherTransform) {
      continue;
    }

    if (!(otherShape.kind === 'polygon' || otherShape.kind === 'circle')) {
      continue;
    }

    const d = distance(transform.position, otherTransform.position);
    if (d > radius) {
      continue;
    }

    const toOther = sub(otherTransform.position, transform.position);
    if (
      best === null ||
      d < best.distance ||
      (d === best.distance && otherId < best.id)
    ) {
      best = {
        id: otherId,
        distance: d,
        direction: d > 0 ? { x: toOther.x / d, y: toOther.y / d } : { x: 1, y: 0 },
      };
    }
  }

  return best;
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
  desireYield: number,
  desireMate: number,
  desireFeel: number,
): SocialIntention {
  if (desireAvoid >= Math.max(desireYield, desireMate, desireFeel, 0.15)) {
    return 'avoid';
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

export class SocialNavMindSystem implements System {
  update(world: World): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      const movement = world.movements.get(id);
      const transform = world.transforms.get(id);
      if (!movement || movement.type !== 'socialNav' || !transform || world.staticObstacles.has(id)) {
        continue;
      }
      if (world.sleep.get(id)?.asleep) {
        movement.intentionTicksLeft = Math.max(0, movement.intentionTicksLeft - 1);
        continue;
      }

      const needDecision = movement.intentionTicksLeft <= 0;
      const visionHit = world.visionHits.get(id);
      const hearingHit = world.hearingHits.get(id);
      const sightHazardDistance = visionHit?.distance ?? Number.POSITIVE_INFINITY;
      const hearingDistance = hearingHit?.distance ?? Number.POSITIVE_INFINITY;
      const contactDistance = world.collisions.some((pair) => pair.a === id || pair.b === id) ? 0 : Number.POSITIVE_INFINITY;
      const hazardDistance = Math.min(sightHazardDistance, hearingDistance, contactDistance);
      const emergencyAvoid = hazardDistance <= Math.max(4, movement.maxSpeed * 0.45);
      let hazardDirection: Vec2 | null = null;
      if (visionHit) {
        const otherTransform = world.transforms.get(visionHit.hitId);
        if (otherTransform) {
          const toOther = sub(otherTransform.position, transform.position);
          const length = Math.hypot(toOther.x, toOther.y);
          hazardDirection =
            length > 0
              ? {
                  x: toOther.x / length,
                  y: toOther.y / length,
                }
              : null;
        }
      }
      if (!hazardDirection && hearingHit) {
        hazardDirection = hearingHit.direction;
      }

      if (!needDecision && !emergencyAvoid) {
        movement.intentionTicksLeft -= 1;
        continue;
      }

      const higher = nearestHigherRank(world, id, ids);
      const mate = nearestMateCandidate(world, id, ids);
      const unknown = nearestUnknownNeighbor(world, id, ids);
      const caution = cautionFactor(world, id);

      const hazardRadius = Math.max(8, movement.maxSpeed * 2.2);
      const desireAvoid =
        hazardDistance === Number.POSITIVE_INFINITY
          ? 0
          : Math.max(0, (hazardRadius - hazardDistance) / hazardRadius) * (0.4 + caution * 0.6);
      const desireYield =
        higher === null ? 0 : Math.max(0, (140 - higher.distance) / 140) * (0.25 + caution * 0.8);
      const desireMate =
        mate === null ? 0 : Math.max(0, (world.config.matingRadius - mate.distance) / Math.max(1, world.config.matingRadius));
      const desireFeel =
        unknown === null
          ? 0
          : Math.max(0, (world.config.feelingApproachRadius - unknown.distance) / Math.max(1, world.config.feelingApproachRadius));

      movement.intention = chooseIntention(movement, desireAvoid, desireYield, desireMate, desireFeel);

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
      } else if (movement.intention === 'approachForFeeling' && unknown) {
        const unknownTransform = world.transforms.get(unknown.id);
        if (unknownTransform) {
          setGoalTarget(movement, unknown.id, unknownTransform.position);
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
      }

      const durationBucket = Math.floor(world.tick / Math.max(1, movement.decisionEveryTicks));
      const jitter = 0.7 + hashNoise(world.seed + 17, id, durationBucket) * 0.6;
      const baseDuration = Math.max(1, movement.intentionMinTicks);
      movement.intentionTicksLeft = Math.max(1, Math.round(baseDuration * jitter));
      if (emergencyAvoid && movement.intention !== 'avoid') {
        movement.intention = 'avoid';
      }
    }
  }
}
