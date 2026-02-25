import { isEntityOutside } from '../core/housing/dwelling';
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
  const overloadRatio = Math.max(0, (world.entities.size - comfortPopulation) / comfortPopulation);
  const overloadScale = 1 + overloadRatio * Math.max(0, roundedConfig(world.config.crowdOverloadWearScale, 0));
  durability.wear += wearScale * stress * overloadScale * dt;

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

  if (!shape.irregular) {
      const comfortPopulation = Math.max(1, Math.round(world.config.crowdComfortPopulation));
      const overloadRatio = Math.max(0, (world.entities.size - comfortPopulation) / comfortPopulation);
      const chance = Math.max(0, world.config.crowdStressIrregularChance) * stress * (1 + overloadRatio * 0.5);
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
      const currentName = world.names.get(entityId);
      if (currentName) {
        world.names.set(entityId, retitleName(currentName, rank.rank, shape));
      }
    }
    return;
  }

  const comfortPopulation = Math.max(1, Math.round(world.config.crowdComfortPopulation));
  const overloadRatio = Math.max(0, (world.entities.size - comfortPopulation) / comfortPopulation);
  const chance =
    Math.max(0, world.config.crowdStressExecutionChance) * stress * (1 + overloadRatio * 0.65);
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

      const stress = crowdStressFromNeighborCount(neighbors, threshold);
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
