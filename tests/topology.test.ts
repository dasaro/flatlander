import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { boundaryFromTopology } from '../src/core/topology';
import { createWorld } from '../src/core/world';
import { MovementSystem } from '../src/systems/movementSystem';

describe('world topology boundary behavior', () => {
  it('wraps position in torus topology', () => {
    const topology = 'torus' as const;
    const world = createWorld(42, {
      width: 100,
      height: 100,
      topology,
    });
    const movement = new MovementSystem();

    const id = spawnEntity(
      world,
      { kind: 'circle', size: 5 },
      {
        type: 'straightDrift',
        vx: 10,
        vy: 0,
        boundary: boundaryFromTopology(topology),
      },
      { x: 99, y: 50 },
    );

    movement.update(world, 1);

    const transform = world.transforms.get(id);
    const drift = world.movements.get(id);
    if (!transform || !drift || drift.type !== 'straightDrift') {
      throw new Error('Missing movement state in topology torus test.');
    }

    expect(transform.position.x).toBeCloseTo(9, 6);
    expect(drift.vx).toBeCloseTo(10, 6);
  });

  it('bounces at edges in bounded topology', () => {
    const topology = 'bounded' as const;
    const world = createWorld(42, {
      width: 100,
      height: 100,
      topology,
    });
    const movement = new MovementSystem();

    const id = spawnEntity(
      world,
      { kind: 'circle', size: 5 },
      {
        type: 'straightDrift',
        vx: 10,
        vy: 0,
        boundary: boundaryFromTopology(topology),
      },
      { x: 99, y: 50 },
    );

    movement.update(world, 1);

    const transform = world.transforms.get(id);
    const drift = world.movements.get(id);
    if (!transform || !drift || drift.type !== 'straightDrift') {
      throw new Error('Missing movement state in topology bounded test.');
    }

    expect(transform.position.x).toBeCloseTo(100, 6);
    expect(drift.vx).toBeCloseTo(-10, 6);
  });

  it('topology boundary mapping changes do not consume RNG state', () => {
    const worldA = createWorld(99);
    const worldB = createWorld(99);

    const boundaryA = boundaryFromTopology('bounded');
    const boundaryB = boundaryFromTopology('torus');
    expect(boundaryA).toBe('bounce');
    expect(boundaryB).toBe('wrap');

    const entityA = spawnEntity(
      worldA,
      { kind: 'polygon', sides: 4, size: 12, irregular: false },
      { type: 'randomWalk', speed: 14, turnRate: 1.5, boundary: boundaryB },
    );
    const entityB = spawnEntity(
      worldB,
      { kind: 'polygon', sides: 4, size: 12, irregular: false },
      { type: 'randomWalk', speed: 14, turnRate: 1.5, boundary: boundaryB },
    );

    const transformA = worldA.transforms.get(entityA);
    const transformB = worldB.transforms.get(entityB);
    const movementA = worldA.movements.get(entityA);
    const movementB = worldB.movements.get(entityB);

    expect(transformA).toEqual(transformB);
    expect(movementA).toEqual(movementB);
  });
});

