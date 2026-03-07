import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { PolicyRegimePhase } from '../core/policy';
import type { System } from './system';

type PolicyShiftReason =
  | 'IrregularitySpike'
  | 'Overcrowding'
  | 'SuppressionOrder'
  | 'Deescalation'
  | 'StabilityRestored';

function nonObstaclePopulation(world: World): number {
  let total = 0;
  for (const id of world.entities) {
    if (!world.staticObstacles.has(id)) {
      total += 1;
    }
  }
  return Math.max(0, total);
}

function irregularPopulation(world: World): number {
  let total = 0;
  for (const id of getSortedEntityIds(world)) {
    if (world.staticObstacles.has(id)) {
      continue;
    }
    const shape = world.shapes.get(id);
    if (!shape || shape.kind !== 'polygon' || !shape.irregular) {
      continue;
    }
    total += 1;
  }
  return total;
}

function updateBaseline(current: number, baseline: number | null, alpha: number): number {
  if (!Number.isFinite(current)) {
    return baseline ?? 0;
  }
  if (baseline === null || !Number.isFinite(baseline)) {
    return current;
  }
  return baseline + (current - baseline) * alpha;
}

function transitionTo(
  world: World,
  phase: PolicyRegimePhase,
  ticksRemaining: number,
  reason: PolicyShiftReason,
): void {
  world.policy.phase = phase;
  world.policy.ticksRemaining = Math.max(0, Math.round(ticksRemaining));
  world.policy.reason = reason;
  world.policy.triggerTicks = 0;
  if (phase === 'agitation') {
    world.policy.cycle += 1;
  }
  world.policyTransitionsThisTick += 1;
  world.events.push({
    type: 'policyShift',
    tick: world.tick,
    phase,
    reason,
  });
}

export class PolicyRegimeSystem implements System {
  update(world: World): void {
    if (!world.config.policyRegimeEnabled) {
      if (world.policy.phase !== 'normal' || world.policy.ticksRemaining !== 0) {
        world.policy.phase = 'normal';
        world.policy.ticksRemaining = 0;
        world.policy.reason = null;
        world.policy.triggerTicks = 0;
      }
      return;
    }

    const comfortPopulation = Math.max(1, Math.round(world.config.crowdComfortPopulation));
    const activePopulation = nonObstaclePopulation(world);
    const irregularShare = irregularPopulation(world) / Math.max(1, activePopulation);
    const overcrowdingRatio = activePopulation / comfortPopulation;
    world.policy.irregularShareBaseline = updateBaseline(
      irregularShare,
      world.policy.irregularShareBaseline,
      0.015,
    );
    world.policy.overcrowdingBaseline = updateBaseline(
      overcrowdingRatio,
      world.policy.overcrowdingBaseline,
      0.015,
    );

    const irregularBaseline = world.policy.irregularShareBaseline ?? irregularShare;
    const overcrowdingBaseline = world.policy.overcrowdingBaseline ?? overcrowdingRatio;
    const irregularTrigger =
      irregularShare >= Math.max(0, world.config.policyTriggerIrregularShare) ||
      irregularShare >= irregularBaseline + Math.max(0, world.config.policyTriggerIrregularDelta);
    const overcrowded =
      overcrowdingRatio >= Math.max(1, world.config.policyTriggerOvercrowding) ||
      overcrowdingRatio >= overcrowdingBaseline + Math.max(0, world.config.policyTriggerOvercrowdingDelta);

    if (world.policy.phase === 'normal') {
      if (world.tick < Math.max(0, Math.round(world.config.policyWarmupTicks))) {
        world.policy.triggerTicks = 0;
        world.policy.reason = null;
        return;
      }
      if (irregularTrigger || overcrowded) {
        const reason: PolicyShiftReason =
          irregularTrigger && overcrowded
            ? irregularShare - irregularBaseline >= overcrowdingRatio - overcrowdingBaseline
              ? 'IrregularitySpike'
              : 'Overcrowding'
            : irregularTrigger
              ? 'IrregularitySpike'
              : 'Overcrowding';
        world.policy.triggerTicks += 1;
        world.policy.reason = reason;
        if (world.policy.triggerTicks >= Math.max(1, Math.round(world.config.policyTriggerPersistenceTicks))) {
          transitionTo(world, 'agitation', world.config.policyAgitationTicks, reason);
        }
      } else {
        world.policy.triggerTicks = 0;
        world.policy.reason = null;
      }
      return;
    }

    if (world.policy.ticksRemaining > 0) {
      world.policy.ticksRemaining -= 1;
      if (world.policy.ticksRemaining > 0) {
        return;
      }
    }

    switch (world.policy.phase) {
      case 'agitation':
        transitionTo(world, 'suppression', world.config.policySuppressionTicks, 'SuppressionOrder');
        break;
      case 'suppression':
        transitionTo(world, 'cooldown', world.config.policyCooldownTicks, 'Deescalation');
        break;
      case 'cooldown':
        transitionTo(world, 'normal', 0, 'StabilityRestored');
        world.policy.irregularShareBaseline = irregularShare;
        world.policy.overcrowdingBaseline = overcrowdingRatio;
        world.policy.reason = null;
        break;
      default:
        break;
    }
  }
}
