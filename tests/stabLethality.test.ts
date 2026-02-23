import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';
import { MovementSystem } from '../src/systems/movementSystem';

function buildSimulation(seed: number) {
  const world = createWorld(seed, {
    southAttractionEnabled: false,
    reproductionEnabled: false,
    topology: 'bounded',
  });

  const systems = [
    new MovementSystem(),
    new CollisionSystem(),
    new CollisionResolutionSystem(),
    new LethalitySystem(),
    new CleanupSystem(),
  ];

  return {
    world,
    simulation: new FixedTimestepSimulation(world, systems),
  };
}

describe('manifold-based stabbing lethality', () => {
  it('does not kill on edge-edge square contact', () => {
    const { world, simulation } = buildSimulation(9001);
    world.config.killSeverityThreshold = 1;
    world.config.pressureTicksToKill = 30;

    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 4, vy: 0, boundary: 'bounce' },
      { x: 180, y: 200 },
    );
    const b = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: -4, vy: 0, boundary: 'bounce' },
      { x: 220, y: 200 },
    );

    const aTransform = world.transforms.get(a);
    const bTransform = world.transforms.get(b);
    if (!aTransform || !bTransform) {
      throw new Error('Missing transforms in edge-edge lethality test.');
    }
    aTransform.rotation = 0;
    bTransform.rotation = 0;

    for (let i = 0; i < 80; i += 1) {
      simulation.stepOneTick();
    }

    expect(world.entities.has(a)).toBe(true);
    expect(world.entities.has(b)).toBe(true);
  });

  it('kills a victim under sustained acute-vertex pressure', () => {
    const world = createWorld(9012, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      topology: 'bounded',
    });
    world.config.killSeverityThreshold = 999;
    world.config.pressureTicksToKill = 14;
    world.config.stabSharpnessExponent = 1.8;

    const attacker = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 26,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.05,
      },
      { type: 'straightDrift', vx: 8, vy: 0, boundary: 'bounce' },
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
      throw new Error('Missing attacker transform in pressure lethality test.');
    }
    attackerTransform.rotation = -Math.PI / 2;

    const simulation = new FixedTimestepSimulation(world, [
      new CollisionSystem(),
      new LethalitySystem(),
      new CleanupSystem(),
    ]);

    let deathTick: number | null = null;
    for (let i = 0; i < 80; i += 1) {
      simulation.stepOneTick();
      if (!world.entities.has(victim)) {
        deathTick = world.tick;
        break;
      }
    }

    expect(deathTick).not.toBeNull();
    expect(deathTick ?? 0).toBeLessThanOrEqual(80);
  });

  it('produces deterministic death tick for a fixed pressure scenario', () => {
    const runDeathTick = (seed: number): number | null => {
      const world = createWorld(seed, {
        southAttractionEnabled: false,
        reproductionEnabled: false,
        topology: 'bounded',
      });
      world.config.killSeverityThreshold = 999;
      world.config.pressureTicksToKill = 14;
      world.config.stabSharpnessExponent = 1.8;

      const attacker = spawnEntity(
        world,
        {
          kind: 'polygon',
          sides: 3,
          size: 26,
          irregular: false,
          triangleKind: 'Isosceles',
          isoscelesBaseRatio: 0.05,
        },
        { type: 'straightDrift', vx: 8, vy: 0, boundary: 'bounce' },
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
        throw new Error('Missing attacker transform in deterministic lethality test.');
      }
      attackerTransform.rotation = -Math.PI / 2;

      const simulation = new FixedTimestepSimulation(world, [
        new CollisionSystem(),
        new LethalitySystem(),
        new CleanupSystem(),
      ]);

      for (let i = 0; i < 80; i += 1) {
        simulation.stepOneTick();
        if (!world.entities.has(victim)) {
          return world.tick;
        }
      }

      return null;
    };

    expect(runDeathTick(9100)).toBe(runDeathTick(9100));
  });
});
