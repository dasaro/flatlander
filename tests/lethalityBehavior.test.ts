import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';

function runCollisionAndLethalityTick(seed = 1) {
  const world = createWorld(seed);
  const collision = new CollisionSystem();
  const lethality = new LethalitySystem();
  const cleanup = new CleanupSystem();

  return {
    world,
    step: () => {
      collision.update(world);
      lethality.update(world);
      cleanup.update(world);
    },
  };
}

describe('lethality behavior', () => {
  it('keeps low-speed square contact non-lethal', () => {
    const { world, step } = runCollisionAndLethalityTick(11);

    const first = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 1, vy: 0, boundary: 'wrap' },
      { x: 200, y: 200 },
    );
    const second = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: -1, vy: 0, boundary: 'wrap' },
      { x: 220, y: 200 },
    );

    const t1 = world.transforms.get(first);
    const t2 = world.transforms.get(second);
    if (!t1 || !t2) {
      throw new Error('Missing transforms for lethality test.');
    }
    t1.rotation = Math.PI / 4;
    t2.rotation = Math.PI / 4;

    step();

    expect(world.entities.has(first)).toBe(true);
    expect(world.entities.has(second)).toBe(true);
  });

  it('kills on high-speed acute isosceles vertex contact', () => {
    const { world, step } = runCollisionAndLethalityTick(12);
    world.config.killThreshold = 20;
    world.config.killSeverityThreshold = 6;
    world.config.pressureTicksToKill = 120;
    world.config.feelSpeedThreshold = 1;

    const attacker = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 30,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.05,
      },
      { type: 'straightDrift', vx: 28, vy: 0, boundary: 'wrap' },
      { x: 200, y: 200 },
    );

    const victim = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 219, y: 200 },
    );

    const attackerTransform = world.transforms.get(attacker);
    if (!attackerTransform) {
      throw new Error('Missing attacker transform.');
    }
    attackerTransform.rotation = -Math.PI / 2;

    step();

    expect(world.entities.has(victim)).toBe(false);
  });

  it('keeps low-speed vertex contact safe for feeling', () => {
    const { world, step } = runCollisionAndLethalityTick(13);
    world.config.killSeverityThreshold = 8;
    world.config.pressureTicksToKill = 1_000;
    world.config.feelSpeedThreshold = 6;

    const attacker = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 30,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.05,
      },
      { type: 'straightDrift', vx: 3, vy: 0, boundary: 'wrap' },
      { x: 200, y: 200 },
    );

    const victim = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 219, y: 200 },
    );

    const attackerTransform = world.transforms.get(attacker);
    if (!attackerTransform) {
      throw new Error('Missing attacker transform.');
    }
    attackerTransform.rotation = -Math.PI / 2;

    step();

    expect(world.entities.has(victim)).toBe(true);
    expect(world.entities.has(attacker)).toBe(true);
    expect(world.combatStats.get(attacker)?.kills ?? 0).toBe(0);
  });
});
