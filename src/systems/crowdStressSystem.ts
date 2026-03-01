import { isEntityOutside } from '../core/housing/dwelling';
import { ensureCoherentJobForEntity } from '../core/jobs';
import { retitleName } from '../core/names';
import { rankFromShape } from '../core/rank';
import { rankKeyForEntity } from '../core/rankKey';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

interface StressSubject {
  id: number;
  position: Vec2;
}

const STRESS_SAMPLE_EVERY_TICKS = 6;
const RAIN_STRESS_BASE_BOOST = 1.8;
const RAIN_STRESS_OCCUPANCY_BOOST = 1.15;
const GLOBAL_OVERLOAD_STRESS_WEIGHT = 3.2;
const RAIN_GLOBAL_OVERLOAD_MULTIPLIER = 2.8;
const RAIN_EXPOSURE_STRESS = 5.3;
const RAIN_SOUTH_EXPOSURE_EXTRA = 0.85;

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function roundedConfig(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value;
}

export function crowdStressFromNeighborCount(neighborCount: number, threshold: number): number {
  const safeThreshold = Math.max(1, threshold);
  const overload = Math.max(0, neighborCount - safeThreshold);
  return overload / safeThreshold;
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

function applyStressWear(world: World, entityId: number, stress: number, dt: number): void {
  if (stress <= 0 || world.staticObstacles.has(entityId)) {
    return;
  }
  const durability = world.durability.get(entityId);
  if (!durability) {
    return;
  }
  const wearScale = Math.max(0, roundedConfig(world.config.crowdStressWearScale, 0));
  const comfortPopulation = Math.max(1, Math.round(roundedConfig(world.config.crowdComfortPopulation, 1)));
  const activePopulation = Math.max(1, world.entities.size - world.staticObstacles.size);
  const overloadRatio = Math.max(0, (activePopulation - comfortPopulation) / comfortPopulation);
  const overloadScale = 1 + overloadRatio * Math.max(0, roundedConfig(world.config.crowdOverloadWearScale, 0));
  const occupancyRatio = activePopulation <= 0 ? 0 : world.insideCountThisTick / activePopulation;
  const rainBoost =
    world.config.rainEnabled && world.weather.isRaining
      ? RAIN_STRESS_BASE_BOOST + occupancyRatio * RAIN_STRESS_OCCUPANCY_BOOST
      : 1;
  durability.wear += wearScale * stress * overloadScale * rainBoost * dt;

  const step = Math.max(0.01, world.config.wearToHpStep);
  if (durability.wear < step) {
    return;
  }
  const hpLoss = Math.floor(durability.wear / step);
  durability.wear -= hpLoss * step;
  durability.hp -= hpLoss;
  if (durability.hp <= 0) {
    markAttritionDeath(world, entityId);
  }
}

function applyStressIrregularity(world: World, entityId: number, stress: number): void {
  const shape = world.shapes.get(entityId);
  if (!shape || shape.kind !== 'polygon') {
    return;
  }
  const comfortPopulation = Math.max(1, Math.round(world.config.crowdComfortPopulation));
  const activePopulation = Math.max(1, world.entities.size - world.staticObstacles.size);
  const overloadRatio = Math.max(0, (activePopulation - comfortPopulation) / comfortPopulation);
  const overloadScale = 1 + overloadRatio * 0.75;
  const occupancyRatio = activePopulation <= 0 ? 0 : world.insideCountThisTick / activePopulation;
  const rainBoost =
    world.config.rainEnabled && world.weather.isRaining
      ? RAIN_STRESS_BASE_BOOST + occupancyRatio * RAIN_STRESS_OCCUPANCY_BOOST
      : 1;

  if (!shape.irregular) {
      const chance =
        Math.max(0, world.config.crowdStressIrregularChance) *
        stress *
        overloadScale *
        rainBoost;
    if (world.rng.next() < chance) {
      shape.irregular = true;
      shape.regular = false;
      shape.irregularity = Math.max(shape.irregularity, world.config.irregularityTolerance + 0.02 + stress * 0.03);
      world.irregularity.set(entityId, {
        deviation: shape.irregularity,
        angleDeviationDeg: Math.min(
          world.config.irregularDeviationCapDeg,
          (world.config.irregularityTolerance + stress) * 20,
        ),
      });
      const rank = rankFromShape(shape, {
        irregularityTolerance: world.config.irregularityTolerance,
        nearCircleThreshold: world.config.nearCircleThreshold,
      });
      world.ranks.set(entityId, rank);
      ensureCoherentJobForEntity(world, entityId);
      const currentName = world.names.get(entityId);
      if (currentName) {
        world.names.set(entityId, retitleName(currentName, rank.rank, shape));
      }
    }
    return;
  }

  const chance =
    Math.max(0, world.config.crowdStressExecutionChance) *
    stress *
    (1 + overloadRatio * 0.95) *
    rainBoost;
  if (world.rng.next() < chance) {
    markAttritionDeath(world, entityId);
  }
}

export class CrowdStressSystem implements System {
  update(world: World, dt: number): void {
    if (!world.config.crowdStressEnabled) {
      return;
    }
    if (world.tick % STRESS_SAMPLE_EVERY_TICKS !== 0) {
      return;
    }
    const effectiveDt = dt * STRESS_SAMPLE_EVERY_TICKS;

    const radius = Math.max(1, roundedConfig(world.config.crowdStressRadius, 1));
    const threshold = Math.max(1, Math.round(roundedConfig(world.config.crowdStressThreshold, 1)));
    const comfortPopulation = Math.max(1, Math.round(roundedConfig(world.config.crowdComfortPopulation, 1)));
    const cellSize = radius;
    const subjects: StressSubject[] = [];
    const cells = new Map<string, number[]>();

    for (const id of getSortedEntityIds(world)) {
      if (world.staticObstacles.has(id) || !isEntityOutside(world, id)) {
        continue;
      }
      const transform = world.transforms.get(id);
      if (!transform) {
        continue;
      }
      const subject: StressSubject = {
        id,
        position: transform.position,
      };
      subjects.push(subject);
      const cellX = Math.floor(subject.position.x / cellSize);
      const cellY = Math.floor(subject.position.y / cellSize);
      const key = cellKey(cellX, cellY);
      const bucket = cells.get(key);
      if (bucket) {
        bucket.push(id);
      } else {
        cells.set(key, [id]);
      }
    }

    const subjectById = new Map<number, StressSubject>();
    for (const subject of subjects) {
      subjectById.set(subject.id, subject);
    }
    for (const bucket of cells.values()) {
      bucket.sort((a, b) => a - b);
    }
    const activePopulation = Math.max(1, subjects.length);
    const overloadRatio = Math.max(0, (activePopulation - comfortPopulation) / comfortPopulation);
    const globalOverloadStress =
      overloadRatio *
      GLOBAL_OVERLOAD_STRESS_WEIGHT *
      (world.weather.isRaining && world.config.rainEnabled ? RAIN_GLOBAL_OVERLOAD_MULTIPLIER : 1);
    const rainExposureActive = world.config.rainEnabled && world.weather.isRaining;
    const southStartY = world.config.height * world.config.southAttractionZoneStartFrac;
    const southSpan = Math.max(1, world.config.height - southStartY);

    const radiusSq = radius * radius;
    for (const subject of subjects) {
      const origin = subject.position;
      const cellX = Math.floor(origin.x / cellSize);
      const cellY = Math.floor(origin.y / cellSize);
      let neighbors = 0;

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          const bucket = cells.get(cellKey(cellX + dx, cellY + dy));
          if (!bucket) {
            continue;
          }
          for (const otherId of bucket) {
            if (otherId === subject.id) {
              continue;
            }
            const other = subjectById.get(otherId);
            if (!other) {
              continue;
            }
            const ddx = other.position.x - origin.x;
            const ddy = other.position.y - origin.y;
            if (ddx * ddx + ddy * ddy <= radiusSq) {
              neighbors += 1;
            }
          }
        }
      }

      const localStress = crowdStressFromNeighborCount(neighbors, threshold);
      const rainExposureStress = rainExposureActive
        ? (() => {
            if (origin.y <= southStartY) {
              return RAIN_EXPOSURE_STRESS;
            }
            const southNorm = Math.min(1, Math.max(0, (origin.y - southStartY) / southSpan));
            return RAIN_EXPOSURE_STRESS * (1 + southNorm * RAIN_SOUTH_EXPOSURE_EXTRA);
          })()
        : 0;
      const stress = localStress + globalOverloadStress + rainExposureStress;
      if (stress <= 0) {
        continue;
      }
      applyStressWear(world, subject.id, stress, effectiveDt);
      if (world.pendingDeaths.has(subject.id)) {
        continue;
      }
      applyStressIrregularity(world, subject.id, stress);
    }
  }
}
