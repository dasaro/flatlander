import { isEntityOutside } from '../core/housing/dwelling';
import { classifyIrregularDisposition, irregularAngleDeviationDeg } from '../core/irregularity';
import { crowdStressMultiplierForPolicy } from '../core/policy';
import { rankKeyForEntity } from '../core/rankKey';
import { requestStillness } from '../core/stillness';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

function markInspectionExecution(world: World, entityId: number, deviationDeg: number): void {
  if (world.pendingDeaths.has(entityId)) {
    return;
  }
  world.pendingDeaths.add(entityId);
  world.deathTypesThisTick.attrition += 1;
  world.deathTypesTotal.attrition += 1;
  world.inspectionExecutedThisTick += 1;

  const transform = world.transforms.get(entityId);
  if (transform) {
    world.events.push({
      type: 'death',
      tick: world.tick,
      entityId,
      pos: transform.position,
      rankKey: rankKeyForEntity(world, entityId),
    });
    world.events.push({
      type: 'inspectionExecuted',
      tick: world.tick,
      entityId,
      pos: transform.position,
      deviationDeg,
      rankKey: rankKeyForEntity(world, entityId),
    });
  }
}

function confinedIds(world: World): number[] {
  return [...world.inspectionConfinement.keys()].sort((a, b) => a - b);
}

function applyConfinement(world: World): void {
  const ids = confinedIds(world);
  for (const id of ids) {
    if (!world.entities.has(id)) {
      world.inspectionConfinement.delete(id);
      continue;
    }

    const confinement = world.inspectionConfinement.get(id);
    if (!confinement) {
      continue;
    }
    confinement.ticksRemaining -= 1;

    requestStillness(world, {
      entityId: id,
      mode: 'full',
      reason: 'waitForBearing',
      ticksRemaining: Math.max(1, confinement.ticksRemaining),
      requestedBy: null,
    });

    const movement = world.movements.get(id);
    if (movement && movement.type === 'socialNav') {
      movement.intention = 'holdStill';
      movement.speed = 0;
      movement.smoothSpeed = 0;
      movement.intentionTicksLeft = Math.max(1, confinement.ticksRemaining);
      delete movement.goal;
    }

    if (confinement.ticksRemaining <= 0) {
      world.inspectionConfinement.delete(id);
    }
  }
}

export class InspectionSystem implements System {
  update(world: World): void {
    applyConfinement(world);

    if (!world.config.inspectionEnabled) {
      return;
    }
    const cadence = Math.max(1, Math.round(world.config.inspectionCadenceTicks));
    if (world.tick % cadence !== 0) {
      return;
    }

    const candidates = getSortedEntityIds(world).filter((id) => {
      if (world.staticObstacles.has(id) || world.pendingDeaths.has(id) || world.inspectionConfinement.has(id)) {
        return false;
      }
      if (!isEntityOutside(world, id)) {
        return false;
      }
      const shape = world.shapes.get(id);
      return shape?.kind === 'polygon' && !!shape.irregular;
    });
    if (candidates.length === 0) {
      return;
    }

    const sampleSize = Math.max(1, Math.round(world.config.inspectionSampleSize));
    const passIndex = Math.floor(world.tick / cadence);
    const start = passIndex % candidates.length;

    let hospitalThreshold = Math.max(0, world.config.inspectionHospitalizeDeviationDeg);
    let executionThreshold = Math.max(hospitalThreshold, world.config.inspectionExecuteDeviationDeg);
    const phase = world.policy.phase;
    if (phase === 'agitation') {
      hospitalThreshold *= 0.92;
    } else if (phase === 'suppression') {
      hospitalThreshold *= 0.85;
      executionThreshold *= 0.92;
    } else if (phase === 'cooldown') {
      hospitalThreshold *= 1.05;
      executionThreshold *= 1.06;
    }

    const phaseStress = crowdStressMultiplierForPolicy(phase);
    const maxExecutions =
      Math.max(0, Math.round(world.config.inspectionMaxExecutionsPerPass)) +
      (phase === 'suppression' ? 1 : 0);
    let executions = 0;

    for (let offset = 0; offset < Math.min(sampleSize, candidates.length); offset += 1) {
      const id = candidates[(start + offset) % candidates.length];
      if (id === undefined) {
        continue;
      }
      world.inspectionInspectedThisTick += 1;
      const shape = world.shapes.get(id);
      const ageTicks = world.ages.get(id)?.ticksAlive ?? 0;
      const deviationDeg = irregularAngleDeviationDeg(shape, world.irregularity.get(id)) * phaseStress;
      const disposition = classifyIrregularDisposition({
        ageTicks,
        frameSetTicks: world.config.irregularFrameSetTicks,
        deviationDeg,
        curableDeviationDeg: world.config.irregularCurableDeviationDeg,
        executionDeviationDeg: executionThreshold,
      });

      // Flatland Part I §7: slight deviations are curable; severe mature cases
      // are condemned only after the figure's frame has begun to set.
      if (disposition === 'condemned' && executions < maxExecutions) {
        executions += 1;
        markInspectionExecution(world, id, deviationDeg);
        continue;
      }

      if (deviationDeg < hospitalThreshold || disposition === 'monitored') {
        continue;
      }
      world.inspectionConfinement.set(id, {
        ticksRemaining: Math.max(1, Math.round(world.config.inspectionHospitalizeTicks)),
      });
      world.inspectionHospitalizedThisTick += 1;
      const transform = world.transforms.get(id);
      if (transform) {
        world.events.push({
          type: 'inspectionHospitalized',
          tick: world.tick,
          entityId: id,
          pos: transform.position,
          deviationDeg,
          durationTicks: Math.max(1, Math.round(world.config.inspectionHospitalizeTicks)),
          rankKey: rankKeyForEntity(world, id),
        });
      }
    }
  }
}
