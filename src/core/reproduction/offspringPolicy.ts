import { clamp } from '../../geometry/vector';
import { baseRatioFromBrainAngleDeg, brainAngleDegFromBaseRatio, nextGenerationalBrainAngleDeg } from '../isosceles';
import type { SpawnShapeConfig } from '../factory';
import type { World } from '../world';

const NEWBORN_POLYGON_SIZE = 12;
const NEWBORN_CIRCLE_RADIUS = 10;

export type ChildSex = 'female' | 'male';

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
  if (baseMale <= 0) {
    return 0;
  }
  if (baseMale >= 1) {
    return 1;
  }
  let femaleCount = 0;
  let maleCount = 0;
  for (const entityId of world.entities) {
    const shape = world.shapes.get(entityId);
    if (!shape) {
      continue;
    }
    if (shape.kind === 'segment') {
      femaleCount += 1;
    } else if (shape.kind === 'polygon' || shape.kind === 'circle') {
      maleCount += 1;
    }
  }

  let balanceMultiplier = 1;
  if (femaleCount > 0 || maleCount > 0) {
    const ratio = femaleCount / Math.max(1, maleCount);
    if (ratio >= 1.2) {
      balanceMultiplier = Math.min(2.6, 1 + (ratio - 1.2) * 0.55);
    } else if (ratio <= 0.9) {
      balanceMultiplier = Math.max(0.35, 1 - (0.9 - ratio) * 0.6);
    }
  }
  const balancedMale = clamp(baseMale * balanceMultiplier, 0, 1);
  const order = fatherOrder(world, fatherId);
  if (order < 6) {
    return balancedMale;
  }

  const penaltyPerSide = Math.max(0, world.config.maleBirthHighRankPenaltyPerSide);
  const highOrderThreshold = Math.max(6, Math.round(world.config.highOrderThresholdSides));
  const highOrderMultiplier = Math.max(1, world.config.highOrderMaleBirthPenaltyMultiplier);
  const extraSides = Math.max(0, order - highOrderThreshold + 1);
  const penalty = (order - 5) * penaltyPerSide + extraSides * penaltyPerSide * (highOrderMultiplier - 1);
  return clamp(balancedMale * Math.max(0.03, 1 - penalty), 0, 1);
}

export function conceptionChanceForFather(world: World, fatherId: number): number {
  const base = clamp(world.config.conceptionChancePerTick, 0, 1);
  const order = fatherOrder(world, fatherId);
  if (order < 6) {
    return base;
  }

  const penaltyPerSide = Math.max(0, world.config.conceptionHighRankPenaltyPerSide);
  const highOrderThreshold = Math.max(6, Math.round(world.config.highOrderThresholdSides));
  const highOrderMultiplier = Math.max(1, world.config.highOrderConceptionPenaltyMultiplier);
  const extraSides = Math.max(0, order - highOrderThreshold + 1);
  const penalty = penaltyPerSide * (order - 5) + extraSides * penaltyPerSide * (highOrderMultiplier - 1);
  return clamp(base * Math.max(0.04, 1 - penalty), 0, 1);
}

export function determineChildSex(world: World, fatherId: number): ChildSex {
  const roll = world.rng.next();
  return roll < maleBirthProbability(world, fatherId) ? 'male' : 'female';
}

export function determineMaleChildShapeFromParents(
  world: World,
  _motherId: number,
  fatherId: number,
): SpawnShapeConfig {
  const fatherShape = world.shapes.get(fatherId);
  if (fatherShape?.kind === 'polygon') {
    const fatherIsIsosceles =
      fatherShape.sides === 3 && fatherShape.triangleKind === 'Isosceles';
    if (fatherIsIsosceles) {
      const fatherBrainAngleDeg =
        world.brainAngles.get(fatherId)?.brainAngleDeg ??
        brainAngleDegFromBaseRatio(fatherShape.isoscelesBaseRatio ?? 0.01);
      const childBrainAngleDeg = nextGenerationalBrainAngleDeg(fatherBrainAngleDeg);

      if (childBrainAngleDeg >= 60 - 1e-9) {
        return {
          kind: 'polygon',
          sides: 3,
          irregular: false,
          triangleKind: 'Equilateral',
          size: NEWBORN_POLYGON_SIZE,
        };
      }

      return {
        kind: 'polygon',
        sides: 3,
        irregular: false,
        triangleKind: 'Isosceles',
        brainAngleDeg: childBrainAngleDeg,
        isoscelesBaseRatio: baseRatioFromBrainAngleDeg(childBrainAngleDeg),
        size: NEWBORN_POLYGON_SIZE,
      };
    }

    // Canon law: regular male polygons beget sons with one additional side.
    const canonicalNextSides = fatherShape.sides + 1;
    const highOrderThreshold = Math.max(6, Math.round(world.config.highOrderThresholdSides));
    const jumpCapByOrder =
      fatherShape.sides >= highOrderThreshold
        ? Math.floor((fatherShape.sides - highOrderThreshold) / 2) + 1
        : 0;
    const configuredJumpCap = Math.max(0, Math.round(world.config.highOrderDevelopmentJumpMax));
    const jumpCap = Math.max(0, Math.min(jumpCapByOrder, configuredJumpCap));
    const jump = jumpCap <= 0 ? 0 : Math.floor(world.rng.next() * (jumpCap + 1));
    const childSides = Math.max(
      3,
      Math.min(world.config.maxPolygonSides, canonicalNextSides + jump),
    );
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
    triangleKind: 'Equilateral',
    size: NEWBORN_POLYGON_SIZE,
  };
}
