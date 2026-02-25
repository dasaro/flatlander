import { spawnEntity, type SpawnMovementConfig, type SpawnShapeConfig } from '../core/factory';
import { getLineagePathToRoot } from '../core/genealogy';
import { houseCentroidWorld } from '../core/housing/houseFactory';
import { hasHouseCapacity } from '../core/housing/shelterPolicy';
import type { Rank } from '../core/rank';
import { rankKeyForEntity } from '../core/rankKey';
import {
  conceptionChanceForFather,
  determineChildSex,
  determineMaleChildShapeFromParents,
} from '../core/reproduction/offspringPolicy';
import { boundaryFromTopology } from '../core/topology';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import { generateAngleDeviationRadialProfile } from '../geometry/polygon';
import { clamp, distance, wrap } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { System } from './system';

const NEWBORN_SEGMENT_LENGTH = 12;
const NEWBORN_SPEED = 10;
const NEWBORN_TURN_RATE = 1.4;
const BIRTH_OFFSET_MIN = 6;
const BIRTH_OFFSET_MAX = 14;
const HOME_REPRODUCTION_RADIUS_MULTIPLIER = 1.45;

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

export function rarityBoostForShare(share: number, strength: number): number {
  const safeShare = Math.max(0, Math.min(1, share));
  const safeStrength = Math.max(0, strength);
  if (safeShare <= 0) {
    return 1 + Math.min(1.25, safeStrength);
  }
  const inverse = 1 / safeShare;
  const raw = 1 + safeStrength * (inverse - 1);
  return Math.max(1, Math.min(2.5, raw));
}

function buildMaleRankShares(world: World, ids: number[]): Map<Rank, number> {
  const counts = new Map<Rank, number>();
  let total = 0;

  for (const id of ids) {
    const shape = world.shapes.get(id);
    if (!shape || !isMaleShape(shape.kind) || world.staticObstacles.has(id)) {
      continue;
    }
    const rank = world.ranks.get(id)?.rank;
    if (!rank) {
      continue;
    }
    total += 1;
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }

  const shares = new Map<Rank, number>();
  if (total <= 0) {
    return shares;
  }
  for (const [rank, count] of counts) {
    shares.set(rank, count / total);
  }
  return shares;
}

function nearestUnbondedFatherId(
  world: World,
  motherId: number,
  motherPosition: Vec2,
  ids: number[],
  maleRankShares: Map<Rank, number>,
): number | null {
  const radius = Math.max(0, world.config.matingRadius * 1.35);
  let bestId: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  const rarityBiasEnabled = world.config.rarityMarriageBiasEnabled;
  const rarityStrength = Math.max(0, world.config.rarityMarriageBiasStrength);

  for (const candidateId of ids) {
    if (candidateId === motherId || world.staticObstacles.has(candidateId)) {
      continue;
    }
    const candidateBond = world.bonds.get(candidateId);
    if (candidateBond && candidateBond.spouseId !== null) {
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

    const rank = world.ranks.get(candidateId)?.rank;
    const share = rank ? (maleRankShares.get(rank) ?? 0) : 0;
    const rarityBoost =
      rarityBiasEnabled && rank ? rarityBoostForShare(share, rarityStrength) : 1;
    const score = candidateDistance / rarityBoost;

    if (
      score < bestScore ||
      (score === bestScore && (bestId === null || candidateId < bestId))
    ) {
      bestScore = score;
      bestId = candidateId;
    }
  }

  return bestId;
}

function assignSharedHomeIfMissing(world: World, motherId: number, fatherId: number): void {
  const motherBond = world.bonds.get(motherId);
  const fatherBond = world.bonds.get(fatherId);
  if (!motherBond || !fatherBond) {
    return;
  }
  if (motherBond.homeHouseId !== null || fatherBond.homeHouseId !== null) {
    const shared = motherBond.homeHouseId ?? fatherBond.homeHouseId;
    if (shared !== null) {
      motherBond.homeHouseId = shared;
      fatherBond.homeHouseId = shared;
    }
    return;
  }
  if (world.houses.size === 0) {
    return;
  }

  const motherTransform = world.transforms.get(motherId);
  const fatherTransform = world.transforms.get(fatherId);
  if (!motherTransform || !fatherTransform) {
    return;
  }

  const midpoint = {
    x: (motherTransform.position.x + fatherTransform.position.x) * 0.5,
    y: (motherTransform.position.y + fatherTransform.position.y) * 0.5,
  };
  const houseIds = [...world.houses.keys()].sort((a, b) => a - b);
  let bestHouseId: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const houseId of houseIds) {
    const house = world.houses.get(houseId);
    const transform = world.transforms.get(houseId);
    if (!house || !transform || !hasHouseCapacity(world, houseId, house)) {
      continue;
    }
    const center = houseCentroidWorld(transform, house);
    const d = distance(midpoint, center);
    if (d < bestDistance || (d === bestDistance && (bestHouseId === null || houseId < bestHouseId))) {
      bestDistance = d;
      bestHouseId = houseId;
    }
  }
  if (bestHouseId !== null) {
    motherBond.homeHouseId = bestHouseId;
    fatherBond.homeHouseId = bestHouseId;
  }
}

function arrangeBondIfNeeded(
  world: World,
  motherId: number,
  motherPosition: Vec2,
  ids: number[],
  maleRankShares: Map<Rank, number>,
): number | null {
  const motherBond = world.bonds.get(motherId);
  if (!motherBond) {
    return null;
  }
  if (motherBond.spouseId !== null) {
    return motherBond.spouseId;
  }
  if (!world.config.rarityMarriageBiasEnabled) {
    return null;
  }

  // Flatland Part I §3 / §12: priest-arranged pairings are modeled as a
  // deterministic rarity-aware household matching pass.

  const fatherId = nearestUnbondedFatherId(world, motherId, motherPosition, ids, maleRankShares);
  if (fatherId === null) {
    return null;
  }
  const fatherBond = world.bonds.get(fatherId);
  if (!fatherBond || fatherBond.spouseId !== null) {
    return null;
  }

  motherBond.spouseId = fatherId;
  fatherBond.spouseId = motherId;
  motherBond.bondedAtTick = world.tick;
  fatherBond.bondedAtTick = world.tick;
  assignSharedHomeIfMissing(world, motherId, fatherId);
  return fatherId;
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

function mutuallyBondedSpouse(world: World, motherId: number): number | null {
  const motherBond = world.bonds.get(motherId);
  if (!motherBond || motherBond.spouseId === null) {
    return null;
  }

  const fatherId = motherBond.spouseId;
  const fatherBond = world.bonds.get(fatherId);
  if (!fatherBond || fatherBond.spouseId !== motherId) {
    return null;
  }

  return fatherId;
}

function sharedHomeHouseId(world: World, motherId: number, fatherId: number): number | null {
  const motherBond = world.bonds.get(motherId);
  const fatherBond = world.bonds.get(fatherId);
  if (!motherBond || !fatherBond) {
    return null;
  }
  if (
    motherBond.homeHouseId !== null &&
    fatherBond.homeHouseId !== null &&
    motherBond.homeHouseId === fatherBond.homeHouseId
  ) {
    return motherBond.homeHouseId;
  }
  if (motherBond.homeHouseId !== null && fatherBond.homeHouseId === null) {
    return motherBond.homeHouseId;
  }
  if (fatherBond.homeHouseId !== null && motherBond.homeHouseId === null) {
    return fatherBond.homeHouseId;
  }
  return motherBond.homeHouseId ?? fatherBond.homeHouseId ?? null;
}

function domesticContextSatisfied(
  world: World,
  motherId: number,
  fatherId: number,
  motherPosition: Vec2,
): boolean {
  const fatherTransform = world.transforms.get(fatherId);
  if (!fatherTransform) {
    return false;
  }
  const pairedDistance = distance(motherPosition, fatherTransform.position);
  if (pairedDistance > Math.max(0, world.config.matingRadius)) {
    return false;
  }

  const homeHouseId = sharedHomeHouseId(world, motherId, fatherId);
  if (!world.config.housesEnabled || world.houses.size === 0) {
    return true;
  }
  if (world.weather.isRaining) {
    return true;
  }
  if (homeHouseId === null) {
    return false;
  }
  const house = world.houses.get(homeHouseId);
  const houseTransform = world.transforms.get(homeHouseId);
  if (!house || !houseTransform) {
    return false;
  }

  const motherDwelling = world.dwellings.get(motherId);
  const fatherDwelling = world.dwellings.get(fatherId);
  if (
    motherDwelling?.state === 'inside' &&
    fatherDwelling?.state === 'inside' &&
    motherDwelling.houseId === homeHouseId &&
    fatherDwelling.houseId === homeHouseId
  ) {
    return true;
  }

  const homeCenter = houseCentroidWorld(houseTransform, house);
  const homeRadius = Math.max(12, world.config.houseSize * HOME_REPRODUCTION_RADIUS_MULTIPLIER);
  return (
    distance(motherPosition, homeCenter) <= homeRadius &&
    distance(fatherTransform.position, homeCenter) <= homeRadius
  );
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

      const childIsFemale = determineChildSex(world, pregnancy.fatherId) === 'female';
      const childShape: SpawnShapeConfig = childIsFemale
        ? {
            kind: 'segment',
            size: NEWBORN_SEGMENT_LENGTH,
          }
        : (() => {
            const male = determineMaleChildShapeFromParents(world, motherId, pregnancy.fatherId);
            if (male.kind !== 'polygon') {
              return male;
            }

            const fatherShape = world.shapes.get(pregnancy.fatherId);
            const fatherIsCanonIsoscelesLineage =
              fatherShape?.kind === 'polygon' &&
              fatherShape.sides === 3 &&
              fatherShape.triangleKind === 'Isosceles';
            const makeIrregular = !fatherIsCanonIsoscelesLineage &&
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
      world.birthsThisTick += 1;
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

    const maleRankShares = buildMaleRankShares(world, ids);

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

      const effectiveCooldown = Math.max(
        Math.max(0, Math.round(fertility.cooldownTicks)),
        Math.max(0, Math.round(world.config.postpartumCooldownTicks)),
      );
      if (world.tick - fertility.lastBirthTick < effectiveCooldown) {
        continue;
      }

      arrangeBondIfNeeded(world, motherId, motherTransform.position, ids, maleRankShares);
      const fatherId = mutuallyBondedSpouse(world, motherId);
      if (fatherId === null) {
        continue;
      }
      const fatherShape = world.shapes.get(fatherId);
      if (!fatherShape || !isMaleShape(fatherShape.kind) || world.staticObstacles.has(fatherId)) {
        continue;
      }
      assignSharedHomeIfMissing(world, motherId, fatherId);
      if (!domesticContextSatisfied(world, motherId, fatherId, motherTransform.position)) {
        continue;
      }

      if (world.rng.next() >= conceptionChanceForFather(world, fatherId)) {
        continue;
      }

      world.pregnancies.set(motherId, {
        fatherId,
        ticksRemaining: gestationTicks,
      });
    }
  }
}
