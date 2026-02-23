import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { baseRatioFromBrainAngleDeg } from '../src/core/isosceles';
import {
  determineChildSex,
  determineMaleChildShapeFromParents,
} from '../src/core/reproduction/offspringPolicy';
import { createWorld } from '../src/core/world';

describe('offspring policy (canon laws)', () => {
  it('applies +1 sides for regular polygon fathers', () => {
    const world = createWorld(801, {
      southAttractionEnabled: false,
      reproductionEnabled: true,
      maxPolygonSides: 20,
    });

    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const fatherSquare = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const fatherPentagon = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 20, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 120 },
    );

    const childFromSquare = determineMaleChildShapeFromParents(world, mother, fatherSquare);
    const childFromPentagon = determineMaleChildShapeFromParents(world, mother, fatherPentagon);

    expect(childFromSquare.kind).toBe('polygon');
    expect(childFromPentagon.kind).toBe('polygon');
    if (childFromSquare.kind === 'polygon' && childFromPentagon.kind === 'polygon') {
      expect(childFromSquare.sides).toBe(5);
      expect(childFromPentagon.sides).toBe(6);
    }
  });

  it('advances isosceles brain angle by 0.5 degrees per generation and caps at 60', () => {
    const world = createWorld(802, {
      southAttractionEnabled: false,
      reproductionEnabled: true,
    });
    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 140 },
    );
    const father = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 20,
        irregular: false,
        triangleKind: 'Isosceles',
        brainAngleDeg: 0.5,
      },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 140 },
    );
    world.brainAngles.set(father, { brainAngleDeg: 0.5 });

    const child = determineMaleChildShapeFromParents(world, mother, father);
    expect(child.kind).toBe('polygon');
    if (child.kind === 'polygon') {
      expect(child.sides).toBe(3);
      expect(child.triangleKind).toBe('Isosceles');
      expect(child.brainAngleDeg).toBeCloseTo(1.0, 8);
      expect(child.isoscelesBaseRatio ?? 0).toBeCloseTo(baseRatioFromBrainAngleDeg(1), 8);
    }

    world.brainAngles.set(father, { brainAngleDeg: 59.5 });
    const capChild = determineMaleChildShapeFromParents(world, mother, father);
    expect(capChild.kind).toBe('polygon');
    if (capChild.kind === 'polygon') {
      expect(capChild.sides).toBe(3);
      expect(capChild.triangleKind).toBe('Equilateral');
      expect(capChild.brainAngleDeg).toBeUndefined();
    }
  });

  it('draws child sex deterministically from seeded rng', () => {
    const sample = (): string => {
      const world = createWorld(803, {
        femaleBirthProbability: 0.5,
      });
      const father = spawnEntity(
        world,
        { kind: 'polygon', sides: 4, size: 20, irregular: false },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 100, y: 100 },
      );
      const sequence: string[] = [];
      for (let i = 0; i < 8; i += 1) {
        sequence.push(determineChildSex(world, father));
      }
      return sequence.join(',');
    };

    expect(sample()).toBe(sample());
  });
});
