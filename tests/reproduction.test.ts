import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { ReproductionSystem } from '../src/systems/reproductionSystem';

function makeMature(world: ReturnType<typeof createWorld>, entityId: number): void {
  const age = world.ages.get(entityId);
  const fertility = world.fertility.get(entityId);
  if (!age || !fertility) {
    throw new Error('Expected mature female components to exist.');
  }

  age.ticksAlive = 10_000;
  fertility.maturityTicks = 0;
  fertility.cooldownTicks = 0;
}

function simulationWithReproduction(world: ReturnType<typeof createWorld>): FixedTimestepSimulation {
  return new FixedTimestepSimulation(world, [new ReproductionSystem()]);
}

describe('reproduction system', () => {
  it('applies basic Law of Nature side inheritance for male children', () => {
    const world = createWorld(55, {
      reproductionEnabled: true,
      gestationTicks: 1,
      matingRadius: 80,
      conceptionChancePerTick: 1,
      femaleBirthProbability: 0,
      maxPopulation: 50,
      maxPolygonSides: 6,
      southAttractionEnabled: false,
    });

    const motherSquare = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const fatherSquare = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );

    const motherPentagon = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 320, y: 120 },
    );
    const fatherPentagon = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 320, y: 120 },
    );

    makeMature(world, motherSquare);
    makeMature(world, motherPentagon);

    const sim = simulationWithReproduction(world);
    sim.stepOneTick();
    sim.stepOneTick();

    const childByFather = new Map<number, number>();
    for (const [childId, lineage] of world.lineage) {
      if (lineage.fatherId === null || lineage.motherId === null) {
        continue;
      }
      const childShape = world.shapes.get(childId);
      if (!childShape || childShape.kind !== 'polygon') {
        continue;
      }
      childByFather.set(lineage.fatherId, childShape.sides);
    }

    expect(childByFather.get(fatherSquare)).toBe(5);
    expect(childByFather.get(fatherPentagon)).toBe(6);
    expect((childByFather.get(fatherPentagon) ?? 0) <= world.config.maxPolygonSides).toBe(true);
  });

  it('spawns child exactly when pregnancy countdown reaches zero', () => {
    const world = createWorld(77, {
      reproductionEnabled: true,
      gestationTicks: 3,
      matingRadius: 60,
      conceptionChancePerTick: 1,
      femaleBirthProbability: 1,
      maxPopulation: 20,
      southAttractionEnabled: false,
    });

    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 180 },
    );
    const father = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 180 },
    );

    makeMature(world, mother);
    const motherFertility = world.fertility.get(mother);
    if (!motherFertility) {
      throw new Error('Missing mother fertility in pregnancy countdown test.');
    }
    motherFertility.cooldownTicks = 10;

    const sim = simulationWithReproduction(world);

    sim.stepOneTick();
    expect(world.pregnancies.get(mother)?.fatherId).toBe(father);
    expect(world.pregnancies.get(mother)?.ticksRemaining).toBe(3);
    expect(world.entities.size).toBe(2);

    sim.stepOneTick();
    expect(world.pregnancies.get(mother)?.ticksRemaining).toBe(2);
    expect(world.entities.size).toBe(2);

    sim.stepOneTick();
    expect(world.pregnancies.get(mother)?.ticksRemaining).toBe(1);
    expect(world.entities.size).toBe(2);

    sim.stepOneTick();
    expect(world.pregnancies.has(mother)).toBe(false);
    expect(world.entities.size).toBe(3);

    const births = [...world.lineage.entries()].filter(([, lineage]) => lineage.motherId === mother);
    expect(births.length).toBe(1);
  });

  it('is deterministic for birth counts and child shapes with same seed', () => {
    const buildSnapshot = (seed: number): string => {
      const world = createWorld(seed, {
        reproductionEnabled: true,
        gestationTicks: 4,
        matingRadius: 90,
        conceptionChancePerTick: 0.55,
        femaleBirthProbability: 0.45,
        maxPopulation: 120,
        southAttractionEnabled: false,
      });

      const motherA = spawnEntity(
        world,
        { kind: 'segment', size: 24 },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 140, y: 200 },
      );
      const fatherA = spawnEntity(
        world,
        { kind: 'polygon', sides: 4, size: 18, irregular: false },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 140, y: 200 },
      );
      const motherB = spawnEntity(
        world,
        { kind: 'segment', size: 24 },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 420, y: 220 },
      );
      const fatherB = spawnEntity(
        world,
        { kind: 'polygon', sides: 5, size: 18, irregular: false },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 420, y: 220 },
      );
      void fatherA;
      void fatherB;

      makeMature(world, motherA);
      makeMature(world, motherB);

      const sim = simulationWithReproduction(world);
      for (let i = 0; i < 40; i += 1) {
        sim.stepOneTick();
      }

      const childRows = [...world.lineage.entries()]
        .filter(([, lineage]) => lineage.motherId !== null && lineage.fatherId !== null)
        .sort((a, b) => a[0] - b[0])
        .map(([childId, lineage]) => {
          const childShape = world.shapes.get(childId);
          return {
            childId,
            motherId: lineage.motherId,
            fatherId: lineage.fatherId,
            generation: lineage.generation,
            kind: childShape?.kind ?? 'missing',
            sides: childShape?.kind === 'polygon' ? childShape.sides : null,
          };
        });

      return JSON.stringify({
        tick: world.tick,
        entities: world.entities.size,
        births: childRows.length,
        childRows,
      });
    };

    const a = buildSnapshot(999);
    const b = buildSnapshot(999);
    expect(a).toBe(b);
  });
});
