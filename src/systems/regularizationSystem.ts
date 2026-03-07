import { ensureCoherentJobForEntity } from '../core/jobs';
import { retitleName } from '../core/names';
import {
  irregularAngleDeviationDeg,
  irregularFrameHasSet,
  regularizePolygonShape,
  updatePolygonFromRadialProfile,
} from '../core/irregularity';
import { rankFromShape, Rank } from '../core/rank';
import { rankKeyForEntity } from '../core/rankKey';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { clamp } from '../geometry/vector';
import type { System } from './system';

export class RegularizationSystem implements System {
  update(world: World, dt: number): void {
    if (!world.config.regularizationEnabled) {
      return;
    }

    const ids = getSortedEntityIds(world);
    const rate = Math.max(0, world.config.regularizationRate);
    const tolerance = Math.max(0, world.config.regularityTolerance);

    for (const id of ids) {
      const shape = world.shapes.get(id);
      const intelligence = world.intelligence.get(id);
      const ageTicks = world.ages.get(id)?.ticksAlive ?? 0;
      const confined = world.inspectionConfinement.has(id);
      if (
        !shape ||
        shape.kind !== 'polygon' ||
        !(shape.irregular ?? false) ||
        !shape.radial ||
        shape.radial.length !== shape.sides ||
        shape.baseRadius === undefined ||
        !intelligence
      ) {
        continue;
      }

      if (!confined && irregularFrameHasSet(ageTicks, world.config.irregularFrameSetTicks)) {
        continue;
      }

      const deviationDeg = irregularAngleDeviationDeg(shape, world.irregularity.get(id));
      const curable = deviationDeg <= world.config.irregularCurableDeviationDeg;
      const ageFactor = irregularFrameHasSet(ageTicks, world.config.irregularFrameSetTicks) ? 0.55 : 1.2;
      const confinementFactor = confined ? 2.4 : 1;
      const curabilityFactor = curable ? 1.15 : 0.78;
      const intelligenceFactor = clamp(0.45 + intelligence.value, 0.45, 1.4);
      const step = clamp(
        rate * intelligenceFactor * ageFactor * confinementFactor * curabilityFactor * dt,
        0,
        1,
      );
      if (step > 0) {
        for (let i = 0; i < shape.radial.length; i += 1) {
          const current = shape.radial[i] ?? 1;
          shape.radial[i] = current + (1 - current) * step;
        }
      }

      const metrics = updatePolygonFromRadialProfile(shape, shape.baseRadius, shape.radial);
      world.irregularity.set(id, metrics);

      if (metrics.deviation > tolerance) {
        continue;
      }

      regularizePolygonShape(shape);
      world.irregularity.delete(id);

      const previousRank = world.ranks.get(id);
      const nextRank = rankFromShape(shape, {
        irregularityTolerance: world.config.irregularityTolerance,
        nearCircleThreshold: world.config.nearCircleThreshold,
      });
      world.ranks.set(id, nextRank);
      ensureCoherentJobForEntity(world, id);
      const currentName = world.names.get(id);
      if (currentName) {
        world.names.set(id, retitleName(currentName, nextRank.rank, shape));
      }

      if (previousRank?.rank === Rank.Irregular && nextRank.rank !== Rank.Irregular) {
        world.regularizedThisTick += 1;
        const legacy = world.legacy.get(id);
        if (legacy) {
          legacy.regularizations += 1;
        }
        const transform = world.transforms.get(id);
        if (transform) {
          world.events.push({
            type: 'regularized',
            tick: world.tick,
            entityId: id,
            pos: transform.position,
            rankKey: rankKeyForEntity(world, id),
          });
        }
      }
    }
  }
}
