import { orderedEntityPairs } from '../core/events';
import { rankKeyForEntity } from '../core/rankKey';
import { requestStillness } from '../core/stillness';
import { angleToVector } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { EntityId } from '../core/components';
import type { World } from '../core/world';
import type { System } from './system';

const TOUCH_EVENTS_PER_TICK_CAP = 100;

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

function canInitiateFeeling(world: World, entityId: EntityId, partnerId: EntityId): boolean {
  if (
    !world.config.feelingEnabledGlobal ||
    world.staticObstacles.has(entityId) ||
    world.staticObstacles.has(partnerId)
  ) {
    return false;
  }

  const feeling = world.feeling.get(entityId);
  if (!feeling || !feeling.enabled) {
    return false;
  }

  if (feeling.state !== 'idle' && !(feeling.state === 'approaching' && feeling.partnerId === partnerId)) {
    return false;
  }

  return world.tick - feeling.lastFeltTick >= feeling.feelCooldownTicks;
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

function tickFeelingStates(world: World): void {
  const ids = [...world.feeling.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const feeling = world.feeling.get(id);
    if (!feeling) {
      continue;
    }

    if (feeling.partnerId !== null && !world.entities.has(feeling.partnerId)) {
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

    feeling.state = 'cooldown';
    feeling.partnerId = null;
    feeling.ticksLeft = Math.max(0, Math.round(feeling.feelCooldownTicks));
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

export class FeelingSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    tickFeelingStates(world);
    const pairs = orderedCollisionPairs(world);
    let touchEventsEmitted = 0;
    const handshakeTicks = Math.max(1, Math.round(world.config.handshakeStillnessTicks));

    for (const pair of pairs) {
      const aRank = world.ranks.get(pair.a);
      const bRank = world.ranks.get(pair.b);
      if (!aRank || !bRank) {
        continue;
      }

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

      const aKnowledge = world.knowledge.get(pair.a);
      const bKnowledge = world.knowledge.get(pair.b);
      const aFeeling = world.feeling.get(pair.a);
      const bFeeling = world.feeling.get(pair.b);
      if (!aKnowledge || !bKnowledge || !aFeeling || !bFeeling) {
        continue;
      }

      const activeRoles = activeHandshakeRoles(world, pair.a, pair.b);
      if (!activeRoles) {
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

            const canInitiateChosen =
              (feelerId === pair.a && canAInitiate) || (feelerId === pair.b && canBInitiate);
            if (canInitiateChosen) {
              setFeelingPair(world, feelerId, feltId, handshakeTicks);
              requestHandshakeStillness(world, feelerId, feltId, handshakeTicks);
            }
          }
        }
      }

      const currentRoles = activeHandshakeRoles(world, pair.a, pair.b);
      if (!currentRoles) {
        continue;
      }

      const holdTicks = Math.max(
        1,
        Math.max(aFeeling.ticksLeft, bFeeling.ticksLeft, handshakeTicks),
      );
      requestHandshakeStillness(world, currentRoles.feelerId, currentRoles.feltId, holdTicks);

      const aLearns = !aKnowledge.known.has(pair.b);
      const bLearns = !bKnowledge.known.has(pair.a);
      const feltStillnessSatisfied = canLearnFromFeeling(
        world,
        currentRoles.feelerId,
        currentRoles.feltId,
      );
      const aCanLearn = aLearns && feltStillnessSatisfied;
      const bCanLearn = bLearns && feltStillnessSatisfied;
      if (!aCanLearn && !bCanLearn) {
        continue;
      }

      if (aCanLearn) {
        aKnowledge.known.set(pair.b, {
          rank: bRank.rank,
          learnedBy: 'feeling',
          learnedAtTick: world.tick,
        });
      }
      if (bCanLearn) {
        bKnowledge.known.set(pair.a, {
          rank: aRank.rank,
          learnedBy: 'feeling',
          learnedAtTick: world.tick,
        });
      }

      if (eventPos && (aCanLearn || bCanLearn)) {
        world.events.push({
          type: 'handshake',
          tick: world.tick,
          aId: pair.a,
          bId: pair.b,
          pos: eventPos,
          aRankKey: rankKeyForEntity(world, pair.a),
          bRankKey: rankKeyForEntity(world, pair.b),
        });
        world.handshakeCounts.set(pair.a, (world.handshakeCounts.get(pair.a) ?? 0) + 1);
        world.handshakeCounts.set(pair.b, (world.handshakeCounts.get(pair.b) ?? 0) + 1);
        const aLegacy = world.legacy.get(pair.a);
        if (aLegacy) {
          aLegacy.handshakes += 1;
        }
        const bLegacy = world.legacy.get(pair.b);
        if (bLegacy) {
          bLegacy.handshakes += 1;
        }
      }

      aFeeling.lastFeltTick = world.tick;
      bFeeling.lastFeltTick = world.tick;
    }
  }
}
