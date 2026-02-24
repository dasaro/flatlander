import { orderedEntityPairs } from '../core/events';
import type { EntityId } from '../core/components';
import { rankKeyForEntity } from '../core/rankKey';
import { requestStillness } from '../core/stillness';
import { angleToVector } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { World } from '../core/world';
import type { System } from './system';

const TOUCH_EVENTS_PER_TICK_CAP = 100;

function pairKey(a: EntityId, b: EntityId): string {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return `${lo}:${hi}`;
}

function relativeSpeed(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function velocityForEntity(world: World, entityId: EntityId): Vec2 {
  const movement = world.movements.get(entityId);
  const southDrift = world.southDrifts.get(entityId)?.vy ?? 0;
  if (!movement) {
    return { x: 0, y: southDrift };
  }

  if (movement.type === 'straightDrift') {
    return {
      x: movement.vx,
      y: movement.vy + southDrift,
    };
  }

  const forward = angleToVector(movement.heading);
  return {
    x: forward.x * movement.speed,
    y: forward.y * movement.speed + southDrift,
  };
}

function orderedCollisionPairs(world: World): Array<{ a: EntityId; b: EntityId }> {
  return orderedEntityPairs(world.collisions);
}

function isIntentionalApproach(world: World, entityId: EntityId, partnerId: EntityId): boolean {
  const feeling = world.feeling.get(entityId);
  if (!feeling || feeling.state !== 'approaching' || feeling.partnerId !== partnerId) {
    return false;
  }

  const movement = world.movements.get(entityId);
  if (!movement || movement.type !== 'socialNav') {
    return true;
  }

  if (movement.intention !== 'approachForFeeling') {
    return false;
  }

  return movement.goal?.targetId === partnerId || movement.goal?.type === 'point';
}

function canInitiateFeeling(world: World, entityId: EntityId, partnerId: EntityId): boolean {
  if (
    !world.config.feelingEnabledGlobal ||
    world.staticObstacles.has(entityId) ||
    world.staticObstacles.has(partnerId)
  ) {
    return false;
  }

  if (!isIntentionalApproach(world, entityId, partnerId)) {
    return false;
  }

  const feeling = world.feeling.get(entityId);
  const partnerFeeling = world.feeling.get(partnerId);
  if (!feeling || !partnerFeeling || !feeling.enabled || !partnerFeeling.enabled) {
    return false;
  }

  const cooldownTicks = Math.max(
    0,
    Math.round(Math.max(feeling.feelCooldownTicks, world.config.handshakeCooldownTicks)),
  );
  const partnerCooldownTicks = Math.max(
    0,
    Math.round(Math.max(partnerFeeling.feelCooldownTicks, world.config.handshakeCooldownTicks)),
  );
  return (
    world.tick - feeling.lastFeltTick >= cooldownTicks &&
    world.tick - partnerFeeling.lastFeltTick >= partnerCooldownTicks
  );
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

function endpointPosition(world: World, entityId: EntityId): Vec2 | null {
  const transform = world.transforms.get(entityId);
  if (!transform) {
    return null;
  }
  return transform.position;
}

function emitUnsuccessfulHandshakeAttempt(
  world: World,
  feelerId: EntityId,
  feltId: EntityId,
  pos: Vec2 | null,
): void {
  if (!pos) {
    return;
  }
  world.events.push({
    type: 'handshakeAttemptFailed',
    tick: world.tick,
    aId: feelerId,
    bId: feltId,
    pos,
    aRankKey: rankKeyForEntity(world, feelerId),
    bRankKey: rankKeyForEntity(world, feltId),
  });
}

function pairKnowledgeEstablished(world: World, aId: EntityId, bId: EntityId): boolean {
  const aKnows = world.knowledge.get(aId)?.known.has(bId) ?? false;
  const bKnows = world.knowledge.get(bId)?.known.has(aId) ?? false;
  return aKnows && bKnows;
}

function tickFeelingStates(world: World): void {
  const ids = [...world.feeling.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const feeling = world.feeling.get(id);
    if (!feeling) {
      continue;
    }

    const partnerId = feeling.partnerId;
    const currentState = feeling.state;

    if (feeling.partnerId !== null && !world.entities.has(feeling.partnerId)) {
      if (currentState === 'feeling') {
        const completed = pairKnowledgeEstablished(world, id, feeling.partnerId);
        if (!completed) {
          emitUnsuccessfulHandshakeAttempt(
            world,
            id,
            feeling.partnerId,
            endpointPosition(world, id),
          );
        }
      } else if (currentState === 'beingFelt') {
        const knowsFeeler = world.knowledge.get(id)?.known.has(feeling.partnerId) ?? false;
        if (!knowsFeeler) {
          emitUnsuccessfulHandshakeAttempt(
            world,
            feeling.partnerId,
            id,
            endpointPosition(world, id),
          );
        }
      }
      feeling.state = 'idle';
      feeling.partnerId = null;
      feeling.ticksLeft = 0;
      continue;
    }

    if (feeling.state === 'idle' || feeling.state === 'approaching') {
      continue;
    }

    if (feeling.ticksLeft > 0) {
      feeling.ticksLeft -= 1;
    }
    if (feeling.ticksLeft > 0) {
      continue;
    }

    if (feeling.state === 'cooldown') {
      feeling.state = 'idle';
      feeling.partnerId = null;
      feeling.ticksLeft = 0;
      continue;
    }

    if (currentState === 'feeling' && partnerId !== null) {
      const completed = pairKnowledgeEstablished(world, id, partnerId);
      if (!completed) {
        emitUnsuccessfulHandshakeAttempt(world, id, partnerId, midpointForPair(world, id, partnerId));
      }
    }

    feeling.state = 'cooldown';
    feeling.partnerId = null;
    feeling.ticksLeft = Math.max(
      0,
      Math.round(Math.max(feeling.feelCooldownTicks, world.config.handshakeCooldownTicks)),
    );
    if (feeling.ticksLeft <= 0) {
      feeling.state = 'idle';
      feeling.ticksLeft = 0;
    }
  }
}

function setHoldStillIntention(world: World, entityId: EntityId, ticks: number): void {
  const movement = world.movements.get(entityId);
  if (!movement || movement.type !== 'socialNav') {
    return;
  }

  movement.intention = 'holdStill';
  movement.intentionTicksLeft = Math.max(movement.intentionTicksLeft, Math.max(1, Math.round(ticks)));
  movement.speed = 0;
  movement.smoothSpeed = 0;
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

function setFeelingPair(
  world: World,
  feelerId: EntityId,
  feltId: EntityId,
  ticks: number,
): void {
  const feeler = world.feeling.get(feelerId);
  const felt = world.feeling.get(feltId);
  if (!feeler || !felt) {
    return;
  }

  feeler.state = 'feeling';
  feeler.partnerId = feltId;
  feeler.ticksLeft = Math.max(1, Math.round(ticks));
  felt.state = 'beingFelt';
  felt.partnerId = feelerId;
  felt.ticksLeft = Math.max(1, Math.round(ticks));
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

function canLearnFromFeeling(world: World, feelerId: EntityId, feltId: EntityId): boolean {
  const feltStillness = world.stillness.get(feltId);
  if (!feltStillness) {
    return false;
  }

  return (
    feltStillness.mode === 'full' &&
    feltStillness.reason === 'beingFelt' &&
    (feltStillness.requestedBy ?? null) === feelerId
  );
}

function startHandshake(world: World, feelerId: EntityId, feltId: EntityId, eventPos: Vec2 | null): void {
  const handshakeTicks = Math.max(1, Math.round(world.config.handshakeStillnessTicks));
  setFeelingPair(world, feelerId, feltId, handshakeTicks);
  requestHandshakeStillness(world, feelerId, feltId, handshakeTicks);
  world.handshakeStartedThisTick += 1;
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

function processActiveHandshakePair(
  world: World,
  aId: EntityId,
  bId: EntityId,
  eventPos: Vec2 | null,
): void {
  const aRank = world.ranks.get(aId);
  const bRank = world.ranks.get(bId);
  const aKnowledge = world.knowledge.get(aId);
  const bKnowledge = world.knowledge.get(bId);
  const aFeeling = world.feeling.get(aId);
  const bFeeling = world.feeling.get(bId);
  if (!aRank || !bRank || !aKnowledge || !bKnowledge || !aFeeling || !bFeeling) {
    return;
  }

  const roles = activeHandshakeRoles(world, aId, bId);
  if (!roles) {
    return;
  }

  const holdTicks = Math.max(1, Math.max(aFeeling.ticksLeft, bFeeling.ticksLeft, world.config.handshakeStillnessTicks));
  requestHandshakeStillness(world, roles.feelerId, roles.feltId, holdTicks);

  const aLearns = !aKnowledge.known.has(bId);
  const bLearns = !bKnowledge.known.has(aId);
  const feltStillnessSatisfied = canLearnFromFeeling(world, roles.feelerId, roles.feltId);
  const aCanLearn = aLearns && feltStillnessSatisfied;
  const bCanLearn = bLearns && feltStillnessSatisfied;
  if (!aCanLearn && !bCanLearn) {
    return;
  }

  if (aCanLearn) {
    aKnowledge.known.set(bId, {
      rank: bRank.rank,
      learnedBy: 'feeling',
      learnedAtTick: world.tick,
    });
  }
  if (bCanLearn) {
    bKnowledge.known.set(aId, {
      rank: aRank.rank,
      learnedBy: 'feeling',
      learnedAtTick: world.tick,
    });
  }

  if (eventPos) {
    world.events.push({
      type: 'handshake',
      tick: world.tick,
      aId,
      bId,
      pos: eventPos,
      aRankKey: rankKeyForEntity(world, aId),
      bRankKey: rankKeyForEntity(world, bId),
    });
  }
  world.handshakeCompletedThisTick += 1;
  world.handshakeCompletedTotal += 1;
  world.handshakeCounts.set(aId, (world.handshakeCounts.get(aId) ?? 0) + 1);
  world.handshakeCounts.set(bId, (world.handshakeCounts.get(bId) ?? 0) + 1);
  const aLegacy = world.legacy.get(aId);
  if (aLegacy) {
    aLegacy.handshakes += 1;
  }
  const bLegacy = world.legacy.get(bId);
  if (bLegacy) {
    bLegacy.handshakes += 1;
  }

  aFeeling.lastFeltTick = world.tick;
  bFeeling.lastFeltTick = world.tick;
}

export class FeelingSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    tickFeelingStates(world);
    const pairs = orderedCollisionPairs(world);
    let touchEventsEmitted = 0;
    const learnedPairs = new Set<string>();

    for (const pair of pairs) {
      const speed = relativeSpeed(
        velocityForEntity(world, pair.a),
        velocityForEntity(world, pair.b),
      );
      if (speed > world.config.feelSpeedThreshold) {
        continue;
      }

      const aGeometry = world.geometries.get(pair.a);
      const bGeometry = world.geometries.get(pair.b);
      if (!aGeometry || !bGeometry) {
        continue;
      }

      const eventPos = midpointForPair(world, pair.a, pair.b);
      if (eventPos && touchEventsEmitted < TOUCH_EVENTS_PER_TICK_CAP) {
        world.events.push({
          type: 'touch',
          tick: world.tick,
          aId: pair.a,
          bId: pair.b,
          pos: eventPos,
          aRankKey: rankKeyForEntity(world, pair.a),
          bRankKey: rankKeyForEntity(world, pair.b),
        });
        touchEventsEmitted += 1;
      }

      if (!activeHandshakeRoles(world, pair.a, pair.b)) {
        const aKnowledge = world.knowledge.get(pair.a);
        const bKnowledge = world.knowledge.get(pair.b);
        if (!aKnowledge || !bKnowledge) {
          continue;
        }

        const aLearns = !aKnowledge.known.has(pair.b);
        const bLearns = !bKnowledge.known.has(pair.a);
        if (aLearns || bLearns) {
          const canAInitiate = canInitiateFeeling(world, pair.a, pair.b);
          const canBInitiate = canInitiateFeeling(world, pair.b, pair.a);
          if (canAInitiate || canBInitiate) {
            let feelerId: EntityId;
            let feltId: EntityId;
            if (aLearns && !bLearns) {
              feelerId = pair.a;
              feltId = pair.b;
            } else if (bLearns && !aLearns) {
              feelerId = pair.b;
              feltId = pair.a;
            } else if (pair.a < pair.b) {
              feelerId = pair.a;
              feltId = pair.b;
            } else {
              feelerId = pair.b;
              feltId = pair.a;
            }

            const canChosenInitiate =
              (feelerId === pair.a && canAInitiate) || (feelerId === pair.b && canBInitiate);
            if (canChosenInitiate) {
              startHandshake(world, feelerId, feltId, eventPos);
            }
          }
        }
      }

      processActiveHandshakePair(world, pair.a, pair.b, eventPos);
      learnedPairs.add(pairKey(pair.a, pair.b));
    }

    const feelingIds = [...world.feeling.keys()].sort((a, b) => a - b);
    for (const feelerId of feelingIds) {
      const feeling = world.feeling.get(feelerId);
      if (!feeling || feeling.state !== 'feeling' || feeling.partnerId === null) {
        continue;
      }
      const partnerId = feeling.partnerId;
      const key = pairKey(feelerId, partnerId);
      if (learnedPairs.has(key)) {
        continue;
      }
      if (!world.entities.has(partnerId)) {
        continue;
      }

      processActiveHandshakePair(world, feelerId, partnerId, midpointForPair(world, feelerId, partnerId));
      learnedPairs.add(key);
    }
  }
}
