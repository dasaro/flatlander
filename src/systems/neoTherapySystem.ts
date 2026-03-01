import { computeDefaultEyeComponent } from '../core/eyePose';
import { ensureCoherentJobForEntity } from '../core/jobs';
import { retitleName } from '../core/names';
import { defaultPerceptionForRank } from '../core/perceptionPresets';
import { rankFromShape, Rank } from '../core/rank';
import { rankKeyForEntity } from '../core/rankKey';
import { defaultVoiceComponent } from '../core/voice';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { regularPolygonVertices } from '../geometry/polygon';
import type { System } from './system';

const NEWBORN_ENROLLMENT_WINDOW_TICKS = 160;
const VETERAN_ENROLLMENT_BASE_PROBABILITY = 0.35;

function hasPriorMaleChild(world: World, childId: number, fatherId: number): boolean {
  for (const [candidateId, lineage] of world.lineage) {
    if (candidateId === childId || lineage.fatherId !== fatherId) {
      continue;
    }
    if (lineage.birthTick > world.tick) {
      continue;
    }
    const shape = world.shapes.get(candidateId);
    if (!shape) {
      continue;
    }
    if (shape.kind === 'polygon' || shape.kind === 'circle') {
      return true;
    }
  }
  return false;
}

function countRareRanks(world: World): { priests: number; nearCircles: number } {
  let priests = 0;
  let nearCircles = 0;
  for (const id of world.entities) {
    if (world.staticObstacles.has(id)) {
      continue;
    }
    const rank = world.ranks.get(id)?.rank;
    if (rank === Rank.Priest) {
      priests += 1;
    } else if (rank === Rank.NearCircle) {
      nearCircles += 1;
    }
  }
  return { priests, nearCircles };
}

function markAttritionDeath(world: World, entityId: number): void {
  if (world.pendingDeaths.has(entityId)) {
    return;
  }
  world.pendingDeaths.add(entityId);
  world.deathTypesThisTick.attrition += 1;
  world.deathTypesTotal.attrition += 1;
  const transform = world.transforms.get(entityId);
  if (!transform) {
    return;
  }
  world.events.push({
    type: 'death',
    tick: world.tick,
    entityId,
    pos: transform.position,
    rankKey: rankKeyForEntity(world, entityId),
  });
}

function promoteByCourtesy(world: World, entityId: number, target: 'NearCircle' | 'Priest'): void {
  const currentShape = world.shapes.get(entityId);
  if (!currentShape) {
    return;
  }

  let nextShape = currentShape;
  if (target === 'Priest') {
    const radius =
      currentShape.kind === 'circle' ? currentShape.radius : Math.max(8, currentShape.boundingRadius * 0.95);
    nextShape = {
      kind: 'circle',
      radius,
      boundingRadius: radius,
    };
  } else {
    const sides = Math.max(
      Math.round(world.config.nearCircleThreshold),
      currentShape.kind === 'polygon' ? currentShape.sides : Math.round(world.config.nearCircleThreshold),
    );
    const baseRadius =
      currentShape.kind === 'polygon' ? (currentShape.baseRadius ?? currentShape.boundingRadius) : currentShape.boundingRadius;
    const vertices = regularPolygonVertices(sides, baseRadius);
    nextShape = {
      kind: 'polygon',
      sides,
      vertices,
      irregularity: 0,
      regular: true,
      irregular: false,
      boundingRadius: baseRadius,
      baseRadius,
    };
  }

  world.shapes.set(entityId, nextShape);
  world.irregularity.delete(entityId);
  world.brainAngles.delete(entityId);

  const nextRank = rankFromShape(nextShape, {
    irregularityTolerance: world.config.irregularityTolerance,
    nearCircleThreshold: world.config.nearCircleThreshold,
  });
  world.ranks.set(entityId, nextRank);
  ensureCoherentJobForEntity(world, entityId);
  const currentName = world.names.get(entityId);
  if (currentName) {
    world.names.set(entityId, retitleName(currentName, nextRank.rank, nextShape));
  }
  world.perceptions.set(entityId, defaultPerceptionForRank(nextRank.rank));
  world.voices.set(entityId, defaultVoiceComponent(nextShape, nextRank.rank));
  world.eyes.set(entityId, computeDefaultEyeComponent(nextShape, world.config.defaultEyeFovDeg));

  const transform = world.transforms.get(entityId);
  if (!transform) {
    return;
  }
  world.events.push({
    type: 'regularized',
    tick: world.tick,
    entityId,
    pos: transform.position,
    rankKey: rankKeyForEntity(world, entityId),
  });
}

export class NeoTherapySystem implements System {
  update(world: World): void {
    if (!world.config.neoTherapyEnabled || !world.config.reproductionEnabled) {
      world.neoTherapy.clear();
      return;
    }

    const recoverySnapshot = countRareRanks(world);
    const priestRecoveryMode = recoverySnapshot.priests === 0;
    const entries = [...world.neoTherapy.entries()].sort((a, b) => a[0] - b[0]);
    for (const [entityId, therapy] of entries) {
      if (!world.entities.has(entityId) || !therapy.enrolled) {
        world.neoTherapy.delete(entityId);
        continue;
      }

      therapy.ticksRemaining -= 1;
      if (therapy.ticksRemaining > 0) {
        continue;
      }

      const survivalProbability = Math.max(
        0,
        Math.min(
          1,
          therapy.target === 'Priest'
            ? priestRecoveryMode
              ? Math.max(world.config.neoTherapySurvivalProbability, 0.42)
              : recoverySnapshot.priests <= 1
                ? Math.max(world.config.neoTherapySurvivalProbability, 0.22)
                : world.config.neoTherapySurvivalProbability
            : world.config.neoTherapySurvivalProbability,
        ),
      );
      const surviveRoll = world.rng.next();
      const survives = surviveRoll < survivalProbability;
      world.neoTherapy.delete(entityId);
      if (!survives) {
        markAttritionDeath(world, entityId);
        continue;
      }

      promoteByCourtesy(world, entityId, therapy.target);
    }

    const rankCounts = countRareRanks(world);
    const aliveNearCircles = rankCounts.nearCircles;
    const shouldRecoverPriests = rankCounts.priests === 0;
    const priestScarcityMode = rankCounts.priests <= 1;

    const threshold = Math.max(3, Math.round(world.config.neoTherapyEnrollmentThresholdSides));
    const scarcityBoost = shouldRecoverPriests
      ? 2.8
      : priestScarcityMode
        ? 1.6
        : aliveNearCircles <= 1
          ? 1.3
          : 1;
    const ambitionProbability = Math.max(
      0,
      Math.min(1, world.config.neoTherapyAmbitionProbability * scarcityBoost),
    );
    const duration = Math.max(1, Math.round(world.config.neoTherapyDurationTicks));
    const enrollmentThreshold = Math.max(
      3,
      threshold - (shouldRecoverPriests ? 3 : priestScarcityMode ? 1 : 0),
    );

    for (const entityId of getSortedEntityIds(world)) {
      if (world.neoTherapy.has(entityId) || world.pendingDeaths.has(entityId)) {
        continue;
      }
      const shape = world.shapes.get(entityId);
      const age = world.ages.get(entityId);
      const lineage = world.lineage.get(entityId);
      if (!shape || !age || !lineage || lineage.fatherId === null) {
        continue;
      }
      if (shape.kind !== 'polygon' || shape.irregular || shape.sides < enrollmentThreshold) {
        continue;
      }
      if (age.ticksAlive > NEWBORN_ENROLLMENT_WINDOW_TICKS) {
        continue;
      }
      if (!shouldRecoverPriests && hasPriorMaleChild(world, entityId, lineage.fatherId)) {
        if (world.rng.next() >= VETERAN_ENROLLMENT_BASE_PROBABILITY) {
          continue;
        }
      }
      const priestRecoveryThreshold = Math.max(
        3,
        Math.round(Math.max(world.config.nearCircleThreshold - 3, enrollmentThreshold)),
      );
      const forceRecoveryEnrollment = shouldRecoverPriests && shape.sides >= priestRecoveryThreshold;
      if (!forceRecoveryEnrollment && world.rng.next() >= ambitionProbability) {
        continue;
      }

      // Scaled canon analogue: near-circular infants can be pushed to courtesy Priest status.
      const priestTargetThreshold = Math.max(
        3,
        Math.max(world.config.nearCircleThreshold - (shouldRecoverPriests ? 5 : priestScarcityMode ? 3 : 2), enrollmentThreshold),
      );
      const target: 'NearCircle' | 'Priest' =
        forceRecoveryEnrollment || shape.sides >= priestTargetThreshold
          ? 'Priest'
          : 'NearCircle';
      world.neoTherapy.set(entityId, {
        enrolled: true,
        ticksRemaining: duration,
        target,
      });
    }
  }
}
