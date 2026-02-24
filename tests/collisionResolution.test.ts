import { describe, expect, it } from 'vitest';

import { spawnEntity, spawnFromRequest } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';
import { MovementSystem } from '../src/systems/movementSystem';

describe('collision resolution', () => {
  it('keeps drifting circles from remaining deeply overlapped', () => {
    const world = createWorld(501, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      topology: 'bounded',
      collisionResolveIterations: 3,
      killThreshold: 9999,
      killSeverityThreshold: 9999,
      pressureTicksToKill: 1_000_000,
      feelSpeedThreshold: 9999,
    });

    const aId = spawnEntity(
      world,
      { kind: 'circle', size: 12 },
      { type: 'straightDrift', vx: 3, vy: 0, boundary: 'bounce' },
      { x: 250, y: 250 },
    );
    const bId = spawnEntity(
      world,
      { kind: 'circle', size: 12 },
      { type: 'straightDrift', vx: -3, vy: 0, boundary: 'bounce' },
      { x: 267, y: 250 },
    );

    const systems = [
      new MovementSystem(),
      new CollisionSystem(),
      new LethalitySystem(),
      new CollisionResolutionSystem(),
      new CleanupSystem(),
    ];
    const simulation = new FixedTimestepSimulation(world, systems);

    const radiusSum = 24;
    for (let i = 0; i < 40; i += 1) {
      simulation.stepOneTick();
      const a = world.transforms.get(aId);
      const b = world.transforms.get(bId);
      if (!a || !b) {
        throw new Error('Missing circle transforms during collision resolution test.');
      }

      const dist = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y);
      expect(dist + 1e-6).toBeGreaterThanOrEqual(radiusSum - 0.5);
    }
  });

  it('prevents two women segments from passing through each other', () => {
    const world = createWorld(777, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      topology: 'bounded',
      collisionResolveIterations: 4,
      lineRadius: 1.2,
      killThreshold: 9999,
      killSeverityThreshold: 9999,
      pressureTicksToKill: 1_000_000,
      feelSpeedThreshold: 9999,
    });

    const leftId = spawnEntity(
      world,
      { kind: 'segment', size: 28 },
      { type: 'straightDrift', vx: 25, vy: 0, boundary: 'bounce' },
      { x: 200, y: 220 },
    );
    const rightId = spawnEntity(
      world,
      { kind: 'segment', size: 28 },
      { type: 'straightDrift', vx: -25, vy: 0, boundary: 'bounce' },
      { x: 260, y: 220 },
    );

    const leftTransform = world.transforms.get(leftId);
    const rightTransform = world.transforms.get(rightId);
    if (!leftTransform || !rightTransform) {
      throw new Error('Missing segment transforms for crossing test.');
    }
    leftTransform.rotation = 0;
    rightTransform.rotation = Math.PI / 2;

    const systems = [
      new MovementSystem(),
      new CollisionSystem(),
      new LethalitySystem(),
      new CollisionResolutionSystem(),
      new CleanupSystem(),
    ];
    const simulation = new FixedTimestepSimulation(world, systems);

    for (let i = 0; i < 80; i += 1) {
      simulation.stepOneTick();
    }

    const leftAfter = world.transforms.get(leftId);
    const rightAfter = world.transforms.get(rightId);
    const leftMovement = world.movements.get(leftId);
    const rightMovement = world.movements.get(rightId);
    if (!leftAfter || !rightAfter || !leftMovement || !rightMovement) {
      throw new Error('Missing entities after segment crossing test.');
    }

    expect(leftAfter.position.x).toBeLessThanOrEqual(rightAfter.position.x + 0.5);
    if (leftMovement.type === 'straightDrift') {
      expect(Math.abs(leftMovement.vx)).toBeLessThanOrEqual(1);
    }
    if (rightMovement.type === 'straightDrift') {
      expect(Math.abs(rightMovement.vx)).toBeLessThanOrEqual(1);
    }
  });

  it('remains deterministic with collision resolution enabled', () => {
    const buildSnapshot = (seed: number): string => {
      const world = createWorld(seed, {
        southAttractionEnabled: false,
        reproductionEnabled: false,
        killThreshold: 9999,
        killSeverityThreshold: 9999,
        pressureTicksToKill: 1_000_000,
        feelSpeedThreshold: 9999,
        lineRadius: 1.2,
      });

      spawnFromRequest(world, {
        shape: {
          kind: 'segment',
          size: 24,
        },
        movement: {
          type: 'randomWalk',
          speed: 18,
          turnRate: 1.2,
          boundary: 'wrap',
        },
        count: 6,
      });

      spawnFromRequest(world, {
        shape: {
          kind: 'circle',
          size: 13,
        },
        movement: {
          type: 'straightDrift',
          vx: 8,
          vy: -5,
          boundary: 'wrap',
        },
        count: 4,
      });

      const systems = [
        new MovementSystem(),
        new CollisionSystem(),
        new LethalitySystem(),
        new CollisionResolutionSystem(),
        new CleanupSystem(),
      ];
      const simulation = new FixedTimestepSimulation(world, systems);

      for (let i = 0; i < 180; i += 1) {
        simulation.stepOneTick();
      }

      const ids = [...world.entities].sort((a, b) => a - b);
      const rows = ids.map((id) => {
        const transform = world.transforms.get(id);
        const movement = world.movements.get(id);
        return {
          id,
          x: Number((transform?.position.x ?? 0).toFixed(6)),
          y: Number((transform?.position.y ?? 0).toFixed(6)),
          movementType: movement?.type ?? 'none',
        };
      });

      return JSON.stringify(rows);
    };

    expect(buildSnapshot(90210)).toBe(buildSnapshot(90210));
  });

  it('keeps sleeping entities stable under low-energy contact', () => {
    const world = createWorld(314, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      topology: 'bounded',
      collisionResolveIterations: 2,
      collisionSlop: 0.2,
      collisionResolvePercent: 0.8,
    });

    const sleeperId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0.8, vy: 0.2, boundary: 'bounce' },
      { x: 100, y: 100 },
    );
    const moverId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: -0.3, vy: 0.1, boundary: 'bounce' },
      { x: 108, y: 100 },
    );

    world.sleep.set(sleeperId, { asleep: true, stillTicks: 50 });

    const sleeperTransform = world.transforms.get(sleeperId);
    if (!sleeperTransform) {
      throw new Error('Missing sleeper transform.');
    }
    sleeperTransform.rotation = 1.234;

    world.manifolds = [
      {
        aId: sleeperId,
        bId: moverId,
        normal: { x: 1, y: 0 },
        penetration: 1.0,
        contactPoint: { x: 104, y: 100 },
        featureA: { kind: 'edge' },
        featureB: { kind: 'edge' },
        closingSpeed: 0.02,
      },
    ];

    const beforePos = { ...sleeperTransform.position };
    const beforeRot = sleeperTransform.rotation;
    const sleeperMovement = world.movements.get(sleeperId);
    const beforeVx = sleeperMovement?.type === 'straightDrift' ? sleeperMovement.vx : 0;
    const beforeVy = sleeperMovement?.type === 'straightDrift' ? sleeperMovement.vy : 0;

    new CollisionResolutionSystem().update(world, 1 / 30);

    const afterTransform = world.transforms.get(sleeperId);
    const afterMovement = world.movements.get(sleeperId);
    if (!afterTransform || !afterMovement || afterMovement.type !== 'straightDrift') {
      throw new Error('Missing sleeper state after resolution.');
    }

    expect(afterTransform.position.x).toBeCloseTo(beforePos.x, 10);
    expect(afterTransform.position.y).toBeCloseTo(beforePos.y, 10);
    expect(afterTransform.rotation).toBeCloseTo(beforeRot, 10);
    expect(afterMovement.vx).toBeCloseTo(beforeVx, 10);
    expect(afterMovement.vy).toBeCloseTo(beforeVy, 10);
  });

  it('does not alter velocity for resting low-energy manifolds', () => {
    const world = createWorld(2718, {
      southAttractionEnabled: false,
      reproductionEnabled: false,
      topology: 'bounded',
      collisionResolveIterations: 1,
      collisionSlop: 0.2,
      collisionResolvePercent: 0.8,
    });

    const aId = spawnEntity(
      world,
      { kind: 'circle', size: 10 },
      { type: 'straightDrift', vx: 1.2, vy: 0, boundary: 'bounce' },
      { x: 200, y: 220 },
    );
    const bId = spawnEntity(
      world,
      { kind: 'circle', size: 10 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'bounce' },
      { x: 221, y: 220 },
    );

    world.manifolds = [
      {
        aId,
        bId,
        normal: { x: 1, y: 0 },
        penetration: 0.1,
        contactPoint: { x: 210, y: 220 },
        featureA: { kind: 'edge' },
        featureB: { kind: 'edge' },
        closingSpeed: 0.01,
      },
    ];

    const aMovement = world.movements.get(aId);
    if (!aMovement || aMovement.type !== 'straightDrift') {
      throw new Error('Expected straight-drift movement for aId.');
    }
    const beforeVx = aMovement.vx;
    const beforeVy = aMovement.vy;

    new CollisionResolutionSystem().update(world, 1 / 30);

    const afterMovement = world.movements.get(aId);
    if (!afterMovement || afterMovement.type !== 'straightDrift') {
      throw new Error('Expected straight-drift movement for aId after resolution.');
    }

    expect(afterMovement.vx).toBeCloseTo(beforeVx, 10);
    expect(afterMovement.vy).toBeCloseTo(beforeVy, 10);
  });
});
