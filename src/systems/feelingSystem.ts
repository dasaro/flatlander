import { orderedEntityPairs } from '../core/events';
import { rankKeyForEntity } from '../core/rankKey';
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

function canFeel(world: World, entityId: EntityId): boolean {
  if (!world.config.feelingEnabledGlobal || world.staticObstacles.has(entityId)) {
    return false;
  }

  const feeling = world.feeling.get(entityId);
  if (!feeling || !feeling.enabled) {
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

function applyHandshakeStillness(world: World, entityId: EntityId): void {
  const configured = Math.max(0, Math.round(world.config.handshakeStillnessTicks));
  const existing = world.stillness.get(entityId);
  if (existing) {
    existing.ticksRemaining = Math.max(existing.ticksRemaining, configured);
    return;
  }

  world.stillness.set(entityId, {
    ticksRemaining: configured,
  });
}

export class FeelingSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    const pairs = orderedCollisionPairs(world);
    let touchEventsEmitted = 0;

    for (const pair of pairs) {
      const aRank = world.ranks.get(pair.a);
      const bRank = world.ranks.get(pair.b);
      if (!aRank || !bRank) {
        continue;
      }

      if (!canFeel(world, pair.a) || !canFeel(world, pair.b)) {
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
      if (!aKnowledge || !bKnowledge) {
        continue;
      }

      const aLearns = !aKnowledge.known.has(pair.b);
      const bLearns = !bKnowledge.known.has(pair.a);

      aKnowledge.known.set(pair.b, {
        rank: bRank.rank,
        learnedBy: 'feeling',
        learnedAtTick: world.tick,
      });
      bKnowledge.known.set(pair.a, {
        rank: aRank.rank,
        learnedBy: 'feeling',
        learnedAtTick: world.tick,
      });

      if (eventPos && (aLearns || bLearns)) {
        world.events.push({
          type: 'handshake',
          tick: world.tick,
          aId: pair.a,
          bId: pair.b,
          pos: eventPos,
          aRankKey: rankKeyForEntity(world, pair.a),
          bRankKey: rankKeyForEntity(world, pair.b),
        });
        applyHandshakeStillness(world, pair.a);
        applyHandshakeStillness(world, pair.b);
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

      const aFeeling = world.feeling.get(pair.a);
      const bFeeling = world.feeling.get(pair.b);
      if (aFeeling) {
        aFeeling.lastFeltTick = world.tick;
      }
      if (bFeeling) {
        bFeeling.lastFeltTick = world.tick;
      }
    }
  }
}
