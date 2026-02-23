import { spawnEntity, type SpawnMovementConfig, type SpawnShapeConfig } from '../core/factory';
import { getLineagePathToRoot } from '../core/genealogy';
import { rankKeyForEntity } from '../core/rankKey';
import { boundaryFromTopology } from '../core/topology';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { generateAngleDeviationRadialProfile } from '../geometry/polygon';
import { clamp, distance, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const NEWBORN_SEGMENT_LENGTH = 12;
const NEWBORN_POLYGON_SIZE = 12;
const NEWBORN_CIRCLE_RADIUS = 10;
const NEWBORN_SPEED = 10;
const NEWBORN_TURN_RATE = 1.4;
const BIRTH_OFFSET_MIN = 6;
const BIRTH_OFFSET_MAX = 14;

function isFemaleShape(shapeKind: 'segment' | 'circle' | 'polygon'): boolean {
  return shapeKind === 'segment';
}

function isMaleShape(shapeKind: 'segment' | 'circle' | 'polygon'): boolean {
  return shapeKind === 'polygon' || shapeKind === 'circle';
}

function newbornMovement(world: World): SpawnMovementConfig {
  return {
    type: 'randomWalk',
    speed: NEWBORN_SPEED,
    turnRate: NEWBORN_TURN_RATE,
    boundary: boundaryFromTopology(world.config.topology),
  };
}

function birthPosition(world: World, motherPosition: Vec2): Vec2 {
  const angle = world.rng.nextRange(0, Math.PI * 2);
  const offset = world.rng.nextRange(BIRTH_OFFSET_MIN, BIRTH_OFFSET_MAX);
  let x = motherPosition.x + Math.cos(angle) * offset;
  let y = motherPosition.y + Math.sin(angle) * offset;

  if (world.config.topology === 'torus') {
    x = wrap(x, world.config.width);
    y = wrap(y, world.config.height);
  } else {
    x = clamp(x, 0, world.config.width);
    y = clamp(y, 0, world.config.height);
  }

  return { x, y };
}

function maleChildShape(world: World, fatherId: number): SpawnShapeConfig {
  const fatherShape = world.shapes.get(fatherId);
  if (fatherShape?.kind === 'polygon') {
    const childSides = Math.max(3, Math.min(world.config.maxPolygonSides, fatherShape.sides + 1));
    return {
      kind: 'polygon',
      sides: childSides,
      irregular: false,
      size: NEWBORN_POLYGON_SIZE,
    };
  }

  if (fatherShape?.kind === 'circle') {
    return {
      kind: 'circle',
      size: NEWBORN_CIRCLE_RADIUS,
    };
  }

  return {
    kind: 'polygon',
    sides: 3,
    irregular: false,
    size: NEWBORN_POLYGON_SIZE,
  };
}

function fatherOrder(world: World, fatherId: number): number {
  const fatherShape = world.shapes.get(fatherId);
  if (!fatherShape) {
    return 3;
  }

  if (fatherShape.kind === 'polygon') {
    return fatherShape.sides;
  }

  if (fatherShape.kind === 'circle') {
    return world.config.maxPolygonSides;
  }

  return 3;
}

function maleBirthProbability(world: World, fatherId: number): number {
  const baseMale = clamp(1 - world.config.femaleBirthProbability, 0, 1);
  const order = fatherOrder(world, fatherId);
  if (order < 6) {
    return baseMale;
  }

  const penaltyPerSide = Math.max(0, world.config.maleBirthHighRankPenaltyPerSide);
  const penalty = (order - 5) * penaltyPerSide;
  return clamp(baseMale * Math.max(0.03, 1 - penalty), 0, 1);
}

function conceptionChanceForPair(world: World, fatherId: number): number {
  const base = clamp(world.config.conceptionChancePerTick, 0, 1);
  const order = fatherOrder(world, fatherId);
  if (order < 6) {
    return base;
  }

  const penalty = Math.max(0, world.config.conceptionHighRankPenaltyPerSide) * (order - 5);
  return clamp(base * Math.max(0.04, 1 - penalty), 0, 1);
}

function irregularBirthChance(world: World, motherId: number, fatherId: number): number {
  if (!world.config.irregularBirthsEnabled) {
    return 0;
  }

  const configuredBase =
    Number.isFinite(world.config.irregularBirthBaseChance) && world.config.irregularBirthBaseChance >= 0
      ? world.config.irregularBirthBaseChance
      : world.config.irregularBirthChance;
  const base = clamp(configuredBase, 0, 1);
  const boost = Math.max(0, world.config.irregularInheritanceBoost);
  const motherShape = world.shapes.get(motherId);
  const fatherShape = world.shapes.get(fatherId);
  const motherIrregular = motherShape?.kind === 'polygon' ? (motherShape.irregular ?? false) : false;
  const fatherIrregular = fatherShape?.kind === 'polygon' ? (fatherShape.irregular ?? false) : false;
  const inherited = motherIrregular || fatherIrregular ? boost : 0;
  return clamp(base + inherited, 0, 1);
}

function nearestFatherId(world: World, motherId: number, motherPosition: Vec2, ids: number[]): number | null {
  const radius = Math.max(0, world.config.matingRadius);
  let bestId: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidateId of ids) {
    if (candidateId === motherId || world.staticObstacles.has(candidateId)) {
      continue;
    }

    const candidateShape = world.shapes.get(candidateId);
    const candidateTransform = world.transforms.get(candidateId);
    if (!candidateShape || !candidateTransform || !isMaleShape(candidateShape.kind)) {
      continue;
    }

    const candidateDistance = distance(motherPosition, candidateTransform.position);
    if (candidateDistance > radius) {
      continue;
    }

    if (
      candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && (bestId === null || candidateId < bestId))
    ) {
      bestDistance = candidateDistance;
      bestId = candidateId;
    }
  }

  return bestId;
}

function incrementAges(world: World, ids: number[]): void {
  for (const id of ids) {
    const age = world.ages.get(id);
    if (age) {
      age.ticksAlive += 1;
      continue;
    }

    world.ages.set(id, { ticksAlive: 1 });
  }
}

export class ReproductionSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    const ids = getSortedEntityIds(world);
    incrementAges(world, ids);

    if (!world.config.reproductionEnabled) {
      return;
    }

    const gestationTicks = Math.max(1, Math.round(world.config.gestationTicks));
    const maxPopulation = Math.max(1, Math.round(world.config.maxPopulation));

    const pregnancyEntries = [...world.pregnancies.entries()].sort((a, b) => a[0] - b[0]);
    for (const [motherId, pregnancy] of pregnancyEntries) {
      if (!world.entities.has(motherId)) {
        world.pregnancies.delete(motherId);
        continue;
      }

      pregnancy.ticksRemaining -= 1;
      if (pregnancy.ticksRemaining > 0) {
        continue;
      }

      if (world.entities.size >= maxPopulation) {
        pregnancy.ticksRemaining = 1;
        continue;
      }

      const motherShape = world.shapes.get(motherId);
      const motherTransform = world.transforms.get(motherId);
      if (!motherShape || !motherTransform || !isFemaleShape(motherShape.kind)) {
        world.pregnancies.delete(motherId);
        continue;
      }

      const childIsFemale = world.rng.next() >= maleBirthProbability(world, pregnancy.fatherId);
      const childShape: SpawnShapeConfig = childIsFemale
        ? {
            kind: 'segment',
            size: NEWBORN_SEGMENT_LENGTH,
          }
        : (() => {
            const male = maleChildShape(world, pregnancy.fatherId);
            if (male.kind !== 'polygon') {
              return male;
            }

            const makeIrregular =
              world.rng.next() < irregularBirthChance(world, motherId, pregnancy.fatherId);
            if (!makeIrregular) {
              return {
                ...male,
                irregular: false,
              };
            }

            const profile = generateAngleDeviationRadialProfile(
              male.sides,
              male.size,
              world.rng,
              world.config.irregularDeviationStdMinDeg,
              world.config.irregularDeviationStdMaxDeg,
              world.config.irregularDeviationCapDeg,
            );
            return {
              ...male,
              irregular: true,
              radial: profile.radial,
              maxDeviationDeg: profile.maxDeviationDeg,
            };
          })();
      const inheritedFemaleRank = childIsFemale
        ? world.femaleStatus.get(motherId)?.femaleRank ?? 'Middle'
        : undefined;

      const childId = spawnEntity(
        world,
        childShape,
        newbornMovement(world),
        birthPosition(world, motherTransform.position),
        undefined,
        undefined,
        undefined,
        undefined,
        inheritedFemaleRank ? { femaleRank: inheritedFemaleRank } : undefined,
      );
      const childTransform = world.transforms.get(childId);
      if (childTransform) {
        world.events.push({
          type: 'birth',
          tick: world.tick,
          childId,
          motherId,
          pos: childTransform.position,
          childRankKey: rankKeyForEntity(world, childId),
          motherRankKey: rankKeyForEntity(world, motherId),
        });
      }

      const motherLineage = world.lineage.get(motherId);
      const fatherLineage = world.lineage.get(pregnancy.fatherId);
      const generation = Math.max(motherLineage?.generation ?? 0, fatherLineage?.generation ?? 0) + 1;
      const dynastyId =
        fatherLineage?.dynastyId ??
        fatherLineage?.id ??
        motherLineage?.dynastyId ??
        motherLineage?.id ??
        childId;
      world.lineage.set(childId, {
        id: childId,
        birthTick: world.tick,
        motherId,
        fatherId: pregnancy.fatherId,
        generation,
        dynastyId,
      });
      const motherLegacy = world.legacy.get(motherId);
      if (motherLegacy) {
        motherLegacy.births += 1;
      }
      const fatherLegacy = world.legacy.get(pregnancy.fatherId);
      if (fatherLegacy) {
        fatherLegacy.births += 1;
      }

      const directAncestors = getLineagePathToRoot(world, childId);
      for (const ancestorId of directAncestors) {
        if (ancestorId === childId) {
          continue;
        }
        const legacy = world.legacy.get(ancestorId);
        if (legacy) {
          legacy.descendantsAlive += 1;
        }
      }

      world.pregnancies.delete(motherId);
      const fertility = world.fertility.get(motherId);
      if (fertility) {
        fertility.lastBirthTick = world.tick;
      }
    }

    if (world.entities.size >= maxPopulation) {
      return;
    }

    for (const motherId of ids) {
      if (world.entities.size >= maxPopulation) {
        break;
      }
      if (world.staticObstacles.has(motherId)) {
        continue;
      }

      const motherShape = world.shapes.get(motherId);
      const motherTransform = world.transforms.get(motherId);
      const fertility = world.fertility.get(motherId);
      const age = world.ages.get(motherId);

      if (
        !motherShape ||
        !motherTransform ||
        !fertility ||
        !fertility.enabled ||
        !isFemaleShape(motherShape.kind) ||
        world.pregnancies.has(motherId)
      ) {
        continue;
      }

      if ((age?.ticksAlive ?? 0) < fertility.maturityTicks) {
        continue;
      }

      if (world.tick - fertility.lastBirthTick < fertility.cooldownTicks) {
        continue;
      }

      const fatherId = nearestFatherId(world, motherId, motherTransform.position, ids);
      if (fatherId === null) {
        continue;
      }

      if (world.rng.next() >= conceptionChanceForPair(world, fatherId)) {
        continue;
      }

      world.pregnancies.set(motherId, {
        fatherId,
        ticksRemaining: gestationTicks,
      });
    }
  }
}
