import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';

function runScenario(): { kills: number; victimAlive: boolean } {
  const world = createWorld(42, {
    reproductionEnabled: false,
  });

  world.config.killSeverityThreshold = 6;
  world.config.pressureTicksToKill = 120;

  const attacker = spawnEntity(
    world,
    { kind: 'segment', size: 20 },
    { type: 'straightDrift', vx: 20, vy: 0, boundary: 'wrap' },
    { x: 100, y: 100 },
  );

  const victim = spawnEntity(
    world,
    { kind: 'polygon', sides: 4, size: 18, irregular: false },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: 110, y: 100 },
  );

  world.geometries.set(attacker, {
    kind: 'segment',
    a: { x: 95, y: 100 },
    b: { x: 105, y: 100 },
  });
  world.geometries.set(victim, {
    kind: 'polygon',
    vertices: [
      { x: 108, y: 96 },
      { x: 114, y: 96 },
      { x: 114, y: 104 },
      { x: 108, y: 104 },
    ],
  });

  world.manifolds = [
    {
      aId: attacker,
      bId: victim,
      normal: { x: 1, y: 0 },
      penetration: 1,
      contactPoint: { x: 107, y: 100 },
      featureA: { kind: 'endpoint', index: 1 },
      featureB: { kind: 'edge' },
      closingSpeed: 14,
    },
  ];

  const lethality = new LethalitySystem();
  const cleanup = new CleanupSystem();
  lethality.update(world);
  cleanup.update(world);

  return {
    kills: world.combatStats.get(attacker)?.kills ?? 0,
    victimAlive: world.entities.has(victim),
  };
}

describe('kill counters', () => {
  it('increments attacker kill count deterministically when lethality marks a victim', () => {
    const runA = runScenario();
    const runB = runScenario();

    expect(runA.kills).toBe(1);
    expect(runA.victimAlive).toBe(false);
    expect(runB).toEqual(runA);
  });
});
