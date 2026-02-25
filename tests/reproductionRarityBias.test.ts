import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { rarityBoostForShare, ReproductionSystem } from '../src/systems/reproductionSystem';

describe('reproduction rarity bias', () => {
  it('rarity boost is clamped and stronger for rarer shares', () => {
    expect(rarityBoostForShare(0.6, 0.4)).toBeGreaterThanOrEqual(1);
    expect(rarityBoostForShare(0.2, 0.4)).toBeGreaterThan(rarityBoostForShare(0.6, 0.4));
    expect(rarityBoostForShare(0, 2)).toBeLessThanOrEqual(2.5);
  });

  it('conceives only with bonded spouse in domestic context', () => {
    const world = createWorld(1002, {
      reproductionEnabled: true,
      gestationTicks: 100,
      matingRadius: 120,
      conceptionChancePerTick: 1,
      conceptionHighRankPenaltyPerSide: 0,
      rarityMarriageBiasEnabled: true,
      rarityMarriageBiasStrength: 0.8,
      southAttractionEnabled: false,
    });

    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 200, y: 200 },
    );
    const motherAge = world.ages.get(mother);
    const fertility = world.fertility.get(mother);
    if (!motherAge || !fertility) {
      throw new Error('Missing mother fertility setup for rarity bias test.');
    }
    motherAge.ticksAlive = 1000;
    fertility.maturityTicks = 0;
    fertility.cooldownTicks = 0;

    const rareNoble = spawnEntity(
      world,
      { kind: 'polygon', sides: 8, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 226, y: 200 },
    );

    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 224, y: 200 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 232, y: 200 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 240, y: 200 },
    );

    const motherBond = world.bonds.get(mother);
    const nobleBond = world.bonds.get(rareNoble);
    if (!motherBond || !nobleBond) {
      throw new Error('Missing bond components for bond-gate test.');
    }
    motherBond.spouseId = rareNoble;
    nobleBond.spouseId = mother;
    motherBond.bondedAtTick = world.tick;
    nobleBond.bondedAtTick = world.tick;

    new ReproductionSystem().update(world, 1 / world.config.tickRate);
    expect(world.pregnancies.get(mother)?.fatherId).toBe(rareNoble);
  });
});
