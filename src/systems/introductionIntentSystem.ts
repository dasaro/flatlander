import type { EntityId, FeelingComponent } from '../core/components';
import { rankKeyForEntity } from '../core/rankKey';
import { requestStillness } from '../core/stillness';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

function pairKey(a: EntityId, b: EntityId): string {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}:${hi}`;
}

function activeHandshakeRoles(
  world: World,
  aId: EntityId,
  bId: EntityId,
): { feelerId: EntityId; feltId: EntityId } | null {
  const aFeeling = world.feeling.get(aId);
  const bFeeling = world.feeling.get(bId);
  if (!aFeeling || !bFeeling) {
    return null;
  }

  const aFeelingB = aFeeling.partnerId === bId && aFeeling.state === 'feeling';
  const bBeingFeltA = bFeeling.partnerId === aId && bFeeling.state === 'beingFelt';
  if (aFeelingB && bBeingFeltA) {
    return { feelerId: aId, feltId: bId };
  }

  const bFeelingA = bFeeling.partnerId === aId && bFeeling.state === 'feeling';
  const aBeingFeltB = aFeeling.partnerId === bId && aFeeling.state === 'beingFelt';
  if (bFeelingA && aBeingFeltB) {
    return { feelerId: bId, feltId: aId };
  }

  return null;
}

function cooldownReady(world: World, feeling: FeelingComponent): boolean {
  const cooldownTicks = Math.max(
    0,
    Math.round(Math.max(feeling.feelCooldownTicks, world.config.handshakeCooldownTicks)),
  );
  return world.tick - feeling.lastFeltTick >= cooldownTicks;
}

function isIntentionalApproach(world: World, feelerId: EntityId, feltId: EntityId): boolean {
  const feeling = world.feeling.get(feelerId);
  if (!feeling || feeling.state !== 'approaching' || feeling.partnerId !== feltId) {
    return false;
  }

  const movement = world.movements.get(feelerId);
  if (!movement || movement.type !== 'socialNav') {
    return true;
  }

  if (movement.intention !== 'approachForFeeling') {
    return false;
  }

  return movement.goal?.targetId === feltId;
}

function setHoldStillIntention(world: World, entityId: EntityId, ticks: number): void {
  const movement = world.movements.get(entityId);
  if (!movement || movement.type !== 'socialNav') {
    return;
  }
  movement.intention = 'holdStill';
  movement.intentionTicksLeft = Math.max(1, Math.round(ticks));
  movement.speed = 0;
  movement.smoothSpeed = 0;
}

function midpointForPair(world: World, aId: EntityId, bId: EntityId): Vec2 | null {
  const aTransform = world.transforms.get(aId);
  const bTransform = world.transforms.get(bId);
  if (!aTransform || !bTransform) {
    return null;
  }

  return {
    x: (aTransform.position.x + bTransform.position.x) / 2,
    y: (aTransform.position.y + bTransform.position.y) / 2,
  };
}

function interactionRadius(world: World, entityId: EntityId): number {
  const shape = world.shapes.get(entityId);
  if (!shape) {
    return 0;
  }
  if (shape.kind === 'segment') {
    return shape.boundingRadius + Math.max(0, world.config.lineRadius);
  }
  return shape.boundingRadius;
}

function requestHandshakeStillness(
  world: World,
  feelerId: EntityId,
  feltId: EntityId,
  ticks: number,
): void {
  requestStillness(world, {
    entityId: feltId,
    mode: 'full',
    reason: 'beingFelt',
    ticksRemaining: ticks,
    requestedBy: feelerId,
  });
  requestStillness(world, {
    entityId: feelerId,
    mode: 'translation',
    reason: 'feeling',
    ticksRemaining: ticks,
    requestedBy: feltId,
  });
  setHoldStillIntention(world, feelerId, ticks);
  setHoldStillIntention(world, feltId, ticks);
}

function startHandshake(world: World, feelerId: EntityId, feltId: EntityId): void {
  const feeler = world.feeling.get(feelerId);
  const felt = world.feeling.get(feltId);
  if (!feeler || !felt) {
    return;
  }

  const handshakeTicks = Math.max(1, Math.round(world.config.handshakeStillnessTicks));
  feeler.state = 'feeling';
  feeler.partnerId = feltId;
  feeler.ticksLeft = handshakeTicks;

  felt.state = 'beingFelt';
  felt.partnerId = feelerId;
  felt.ticksLeft = handshakeTicks;

  requestHandshakeStillness(world, feelerId, feltId, handshakeTicks);
  world.handshakeStartedThisTick += 1;

  const eventPos = midpointForPair(world, feelerId, feltId);
  if (!eventPos) {
    return;
  }

  world.events.push({
    type: 'handshakeStart',
    tick: world.tick,
    aId: feelerId,
    bId: feltId,
    pos: eventPos,
    aRankKey: rankKeyForEntity(world, feelerId),
    bRankKey: rankKeyForEntity(world, feltId),
  });
}

export function requestIntroductionWithNearestUnknown(
  world: World,
  feelerId: EntityId,
): boolean {
  if (!world.entities.has(feelerId) || world.staticObstacles.has(feelerId)) {
    return false;
  }

  const feelerTransform = world.transforms.get(feelerId);
  const knowledge = world.knowledge.get(feelerId);
  const feeling = world.feeling.get(feelerId);
  if (!feelerTransform || !knowledge || !feeling || !feeling.enabled) {
    return false;
  }

  let nearestId: EntityId | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  const introRadius = Math.max(0, world.config.introductionRadius);
  const ids = getSortedEntityIds(world);

  for (const otherId of ids) {
    if (otherId === feelerId || knowledge.known.has(otherId) || world.staticObstacles.has(otherId)) {
      continue;
    }
    const otherTransform = world.transforms.get(otherId);
    if (!otherTransform) {
      continue;
    }

    const distance = Math.hypot(
      otherTransform.position.x - feelerTransform.position.x,
      otherTransform.position.y - feelerTransform.position.y,
    );
    if (distance > introRadius) {
      continue;
    }

    if (distance < nearestDistance || (distance === nearestDistance && otherId < (nearestId ?? Infinity))) {
      nearestDistance = distance;
      nearestId = otherId;
    }
  }

  if (nearestId === null) {
    return false;
  }

  feeling.state = 'approaching';
  feeling.partnerId = nearestId;
  feeling.ticksLeft = 0;

  const movement = world.movements.get(feelerId);
  if (movement && movement.type === 'socialNav') {
    movement.intention = 'approachForFeeling';
    movement.goal = {
      type: 'point',
      targetId: nearestId,
    };
    movement.intentionTicksLeft = Math.max(1, movement.intentionMinTicks);
  }

  return true;
}

export class IntroductionIntentSystem implements System {
  update(world: World): void {
    if (!world.config.feelingEnabledGlobal) {
      return;
    }

    const ids = getSortedEntityIds(world);
    const introRadius = Math.max(0, world.config.introductionRadius);
    const preContactRadius = Math.max(0, world.config.preContactRadius);
    const processedPairs = new Set<string>();

    for (const feelerId of ids) {
      if (world.staticObstacles.has(feelerId) || world.sleep.get(feelerId)?.asleep) {
        continue;
      }

      const feeler = world.feeling.get(feelerId);
      const feelerKnowledge = world.knowledge.get(feelerId);
      const feelerTransform = world.transforms.get(feelerId);
      if (!feeler || !feeler.enabled || !feelerKnowledge || !feelerTransform) {
        continue;
      }
      if (feeler.state !== 'approaching' || feeler.partnerId === null) {
        continue;
      }

      const feltId = feeler.partnerId;
      if (processedPairs.has(pairKey(feelerId, feltId))) {
        continue;
      }
      if (
        !world.entities.has(feltId) ||
        feelerKnowledge.known.has(feltId) ||
        world.staticObstacles.has(feltId)
      ) {
        feeler.state = 'idle';
        feeler.partnerId = null;
        feeler.ticksLeft = 0;
        continue;
      }

      const felt = world.feeling.get(feltId);
      const feltTransform = world.transforms.get(feltId);
      if (!felt || !felt.enabled || !feltTransform) {
        continue;
      }

      if (!isIntentionalApproach(world, feelerId, feltId)) {
        continue;
      }
      if (!cooldownReady(world, feeler) || !cooldownReady(world, felt)) {
        continue;
      }
      if (activeHandshakeRoles(world, feelerId, feltId)) {
        continue;
      }

      const centerDist = Math.hypot(
        feltTransform.position.x - feelerTransform.position.x,
        feltTransform.position.y - feelerTransform.position.y,
      );
      const surfaceDist =
        centerDist - (interactionRadius(world, feelerId) + interactionRadius(world, feltId));

      if (centerDist > introRadius || surfaceDist > preContactRadius) {
        continue;
      }

      startHandshake(world, feelerId, feltId);
      processedPairs.add(pairKey(feelerId, feltId));
    }
  }
}
