import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { ErosionSystem } from '../src/systems/erosionSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';

function assertDeathInvariant(
  deathsThisTick: number,
  killDeaths: number,
  attritionDeaths: number,
): void {
  expect(deathsThisTick).toBe(killDeaths + attritionDeaths);
}

describe('death type counters', () => {
  it('tracks kill deaths consistently with per-tick totals', () => {
    const world = createWorld(13001, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      wearEnabled: false,
      topology: 'bounded',
    });
    world.config.killSeverityThreshold = 0.6;
    world.config.pressureTicksToKill = 8;

    const attacker = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 24,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.05,
      },
      { type: 'straightDrift', vx: 10, vy: 0, boundary: 'bounce' },
      { x: 180, y: 220 },
    );

    const victim = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: 198, y: 220 },
    );

    const attackerTransform = world.transforms.get(attacker);
    if (!attackerTransform) {
      throw new Error('Missing attacker transform in kill death counter test.');
    }
    attackerTransform.rotation = -Math.PI / 2;

    const simulation = new FixedTimestepSimulation(world, [
      new CollisionSystem(),
      new LethalitySystem(),
      new CleanupSystem(),
    ]);

    let observedDeaths = 0;
    for (let step = 0; step < 80; step += 1) {
      simulation.stepOneTick();
      assertDeathInvariant(
        world.deathsThisTick,
        world.deathTypesThisTick.kill,
        world.deathTypesThisTick.attrition,
      );
      observedDeaths += world.deathsThisTick;
      if (!world.entities.has(victim)) {
        break;
      }
    }

    expect(world.entities.has(victim)).toBe(false);
    expect(world.deathTypesTotal.kill).toBeGreaterThan(0);
    expect(world.deathTypesTotal.attrition).toBe(0);
    expect(world.deathTypesTotal.kill + world.deathTypesTotal.attrition).toBe(observedDeaths);
  });

  it('tracks attrition deaths consistently with per-tick totals', () => {
    const world = createWorld(13002, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      wearEnabled: true,
      topology: 'bounded',
    });
    world.config.wearRate = 120;
    world.config.wearToHpStep = 0.2;
    world.config.stabHpDamageScale = 0;

    const a = spawnEntity(
      world,
      { kind: 'circle', size: 12 },
      { type: 'straightDrift', vx: 0, vy: 8, boundary: 'bounce' },
      { x: 250, y: 250 },
    );
    const b = spawnEntity(
      world,
      { kind: 'circle', size: 12 },
      { type: 'straightDrift', vx: 0, vy: -8, boundary: 'bounce' },
      { x: 265, y: 250 },
    );

    const durabilityA = world.durability.get(a);
    const durabilityB = world.durability.get(b);
    if (!durabilityA || !durabilityB) {
      throw new Error('Missing durability in attrition death counter test.');
    }
    durabilityA.maxHp = 1;
    durabilityA.hp = 1;
    durabilityA.wear = 0;
    durabilityB.maxHp = 1;
    durabilityB.hp = 1;
    durabilityB.wear = 0;

    const simulation = new FixedTimestepSimulation(world, [
      new CollisionSystem(),
      new ErosionSystem(),
      new CleanupSystem(),
    ]);

    let observedDeaths = 0;
    for (let step = 0; step < 20; step += 1) {
      simulation.stepOneTick();
      assertDeathInvariant(
        world.deathsThisTick,
        world.deathTypesThisTick.kill,
        world.deathTypesThisTick.attrition,
      );
      observedDeaths += world.deathsThisTick;
      if (!world.entities.has(a) && !world.entities.has(b)) {
        break;
      }
    }

    expect(world.entities.has(a)).toBe(false);
    expect(world.entities.has(b)).toBe(false);
    expect(world.deathTypesTotal.kill).toBe(0);
    expect(world.deathTypesTotal.attrition).toBeGreaterThan(0);
    expect(world.deathTypesTotal.kill + world.deathTypesTotal.attrition).toBe(observedDeaths);
  });
});
