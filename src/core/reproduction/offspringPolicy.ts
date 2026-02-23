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
  const order = fatherOrder(world, fatherId);
  if (order < 6) {
    return baseMale;
  }

  const penaltyPerSide = Math.max(0, world.config.maleBirthHighRankPenaltyPerSide);
  const penalty = (order - 5) * penaltyPerSide;
  return clamp(baseMale * Math.max(0.03, 1 - penalty), 0, 1);
}

export function conceptionChanceForFather(world: World, fatherId: number): number {
  const base = clamp(world.config.conceptionChancePerTick, 0, 1);
  const order = fatherOrder(world, fatherId);
  if (order < 6) {
    return base;
  }

  const penalty = Math.max(0, world.config.conceptionHighRankPenaltyPerSide) * (order - 5);
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
    triangleKind: 'Equilateral',
    size: NEWBORN_POLYGON_SIZE,
  };
}
