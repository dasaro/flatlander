import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { SleepSystem } from '../src/systems/sleepSystem';

function createSettlingSimulation(seed: number) {
  const world = createWorld(seed, {
    southAttractionEnabled: false,
    sleepEnabled: true,
    sleepAfterTicks: 6,
    sleepSpeedEps: 0.12,
    sleepCorrectionEps: 0.08,
    collisionResolveIterations: 3,
  });

  const a = spawnEntity(
    world,
    { kind: 'polygon', sides: 4, size: 20, irregular: false },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: 200, y: 200 },
  );
  const b = spawnEntity(
    world,
    { kind: 'polygon', sides: 4, size: 20, irregular: false },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: 203, y: 200 },
  );

  const simulation = new FixedTimestepSimulation(world, [
    new SleepSystem(),
    new MovementSystem(),
    new CollisionSystem(),
    new CollisionResolutionSystem(),
  ]);

  return { world, simulation, a, b };
}

describe('sleep stabilization', () => {
  it('puts settled entities to sleep deterministically', () => {
    const run = (seed: number): number => {
      const { world, simulation, a } = createSettlingSimulation(seed);
      let sleepTick = -1;
      for (let i = 0; i < 120; i += 1) {
        simulation.stepOneTick();
        if (world.sleep.get(a)?.asleep) {
          sleepTick = world.tick;
          break;
        }
      }
      return sleepTick;
    };

    const t1 = run(707);
    const t2 = run(707);
    expect(t1).toBeGreaterThan(0);
    expect(t1).toBe(t2);
  });

  it('keeps asleep entities effectively stationary', () => {
    const { world, simulation, a, b } = createSettlingSimulation(808);

    for (let i = 0; i < 140; i += 1) {
      simulation.stepOneTick();
    }

    expect(world.sleep.get(a)?.asleep ?? false).toBe(true);
    expect(world.sleep.get(b)?.asleep ?? false).toBe(true);

    const beforeA = world.transforms.get(a)?.position;
    const beforeB = world.transforms.get(b)?.position;
    if (!beforeA || !beforeB) {
      throw new Error('Missing transforms in sleep stationarity test.');
    }

    for (let i = 0; i < 20; i += 1) {
      simulation.stepOneTick();
    }

    const afterA = world.transforms.get(a)?.position;
    const afterB = world.transforms.get(b)?.position;
    if (!afterA || !afterB) {
      throw new Error('Missing transforms after sleep stationarity steps.');
    }

    const deltaA = Math.hypot(afterA.x - beforeA.x, afterA.y - beforeA.y);
    const deltaB = Math.hypot(afterB.x - beforeB.x, afterB.y - beforeB.y);
    expect(deltaA).toBeLessThan(1e-5);
    expect(deltaB).toBeLessThan(1e-5);
  });

  it('keeps transform rotations finite over long runs', () => {
    const { world, simulation } = createSettlingSimulation(909);

    for (let i = 0; i < 300; i += 1) {
      simulation.stepOneTick();
      for (const transform of world.transforms.values()) {
        expect(Number.isFinite(transform.rotation)).toBe(true);
      }
    }
  });
});
