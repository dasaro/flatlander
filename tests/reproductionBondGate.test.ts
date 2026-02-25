import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { ReproductionSystem } from '../src/systems/reproductionSystem';

function matureMother(world: ReturnType<typeof createWorld>, motherId: number): void {
  const age = world.ages.get(motherId);
  const fertility = world.fertility.get(motherId);
  if (!age || !fertility) {
    throw new Error('Expected age/fertility components for mother.');
  }
  age.ticksAlive = 10_000;
  fertility.maturityTicks = 0;
  fertility.cooldownTicks = 0;
}

function bondPair(world: ReturnType<typeof createWorld>, womanId: number, manId: number): void {
  const womanBond = world.bonds.get(womanId);
  const manBond = world.bonds.get(manId);
  if (!womanBond || !manBond) {
    throw new Error('Expected bond components for spouse setup.');
  }
  womanBond.spouseId = manId;
  manBond.spouseId = womanId;
  womanBond.bondedAtTick = world.tick;
  manBond.bondedAtTick = world.tick;
}

describe('reproduction domestic bond gate', () => {
  it('does not conceive for unbonded nearby pairs, but does for bonded spouses', () => {
    const world = createWorld(6301, {
      reproductionEnabled: true,
      housesEnabled: false,
      rainEnabled: false,
      rarityMarriageBiasEnabled: false,
      gestationTicks: 5,
      matingRadius: 80,
      conceptionChancePerTick: 1,
      femaleBirthProbability: 0.5,
      southAttractionEnabled: false,
    });

    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 220, y: 220 },
    );
    const spouse = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 228, y: 220 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 6, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 224, y: 220 },
    );

    matureMother(world, mother);

    const reproduction = new ReproductionSystem();
    reproduction.update(world, 1 / world.config.tickRate);
    expect(world.pregnancies.has(mother)).toBe(false);

    bondPair(world, mother, spouse);
    reproduction.update(world, 1 / world.config.tickRate);
    expect(world.pregnancies.get(mother)?.fatherId).toBe(spouse);
  });

  it('respects postpartum cooldown before new conception', () => {
    const world = createWorld(6302, {
      reproductionEnabled: true,
      housesEnabled: false,
      rainEnabled: false,
      rarityMarriageBiasEnabled: false,
      gestationTicks: 4,
      matingRadius: 80,
      conceptionChancePerTick: 1,
      femaleBirthProbability: 0.5,
      postpartumCooldownTicks: 30,
      southAttractionEnabled: false,
    });

    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 180, y: 180 },
    );
    const father = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 188, y: 180 },
    );

    matureMother(world, mother);
    bondPair(world, mother, father);

    const fertility = world.fertility.get(mother);
    if (!fertility) {
      throw new Error('Expected fertility for postpartum test.');
    }

    fertility.lastBirthTick = world.tick;
    const reproduction = new ReproductionSystem();
    reproduction.update(world, 1 / world.config.tickRate);
    expect(world.pregnancies.has(mother)).toBe(false);

    world.tick = 31;
    reproduction.update(world, 1 / world.config.tickRate);
    expect(world.pregnancies.get(mother)?.fatherId).toBe(father);
  });
});
