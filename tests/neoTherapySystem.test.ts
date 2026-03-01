import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { Rank } from '../src/core/rank';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { NeoTherapySystem } from '../src/systems/neoTherapySystem';

describe('neo-therapy system', () => {
  it('produces deterministic survival outcomes for enrolled subjects', () => {
    const snapshot = (): string => {
      const world = createWorld(1201, {
        neoTherapyEnabled: true,
        neoTherapySurvivalProbability: 0.35,
      });
      const candidate = spawnEntity(
        world,
        { kind: 'polygon', sides: 16, size: 18, irregular: false },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 160, y: 160 },
      );
      world.neoTherapy.set(candidate, {
        enrolled: true,
        ticksRemaining: 1,
        target: 'NearCircle',
      });

      const sim = new FixedTimestepSimulation(world, [new NeoTherapySystem()]);
      sim.stepOneTick();

      return JSON.stringify({
        pendingDeath: world.pendingDeaths.has(candidate),
        stillEnrolled: world.neoTherapy.has(candidate),
        rank: world.ranks.get(candidate)?.rank ?? 'None',
        shapeKind: world.shapes.get(candidate)?.kind ?? 'None',
      });
    };

    expect(snapshot()).toBe(snapshot());
  });

  it('treats enrolled therapy subjects as non-outside for movement/collision', () => {
    const world = createWorld(1202, {
      neoTherapyEnabled: true,
      southAttractionEnabled: false,
    });
    const enrolled = spawnEntity(
      world,
      { kind: 'polygon', sides: 6, size: 18, irregular: false },
      { type: 'straightDrift', vx: 8, vy: 0, boundary: 'wrap' },
      { x: 300, y: 300 },
    );
    const other = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 300, y: 300 },
    );
    void other;

    world.neoTherapy.set(enrolled, {
      enrolled: true,
      ticksRemaining: 20,
      target: 'NearCircle',
    });

    const before = { ...world.transforms.get(enrolled)!.position };
    new MovementSystem().update(world, 1 / world.config.tickRate);
    new CollisionSystem().update(world);

    const after = world.transforms.get(enrolled)!.position;
    expect(after.x).toBe(before.x);
    expect(after.y).toBe(before.y);
    expect(world.collisions.some((pair) => pair.a === enrolled || pair.b === enrolled)).toBe(false);
  });

  it('enables deterministic priest-recovery enrollment when priests are absent', () => {
    const world = createWorld(1203, {
      neoTherapyEnabled: true,
      reproductionEnabled: true,
      nearCircleThreshold: 15,
      neoTherapyEnrollmentThresholdSides: 12,
      neoTherapyAmbitionProbability: 0,
    });
    const candidate = spawnEntity(
      world,
      { kind: 'polygon', sides: 13, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 200, y: 220 },
    );
    const lineage = world.lineage.get(candidate);
    if (!lineage) {
      throw new Error('Missing lineage for neo-therapy recovery test.');
    }
    lineage.fatherId = 10;
    const age = world.ages.get(candidate);
    if (!age) {
      throw new Error('Missing age for neo-therapy recovery test.');
    }
    age.ticksAlive = 3;

    new NeoTherapySystem().update(world);
    const therapy = world.neoTherapy.get(candidate);
    expect(therapy?.enrolled).toBe(true);
    expect(therapy?.target).toBe('Priest');
  });

  it('can recover a priest by courtesy promotion from eligible polygon newborns', () => {
    const world = createWorld(1204, {
      neoTherapyEnabled: true,
      reproductionEnabled: true,
      nearCircleThreshold: 15,
      neoTherapyEnrollmentThresholdSides: 12,
      neoTherapyAmbitionProbability: 0,
      neoTherapyDurationTicks: 1,
      neoTherapySurvivalProbability: 1,
    });
    const candidate = spawnEntity(
      world,
      { kind: 'polygon', sides: 13, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 240, y: 220 },
    );
    const lineage = world.lineage.get(candidate);
    if (!lineage) {
      throw new Error('Missing lineage for neo-therapy priest recovery test.');
    }
    lineage.fatherId = 11;
    const age = world.ages.get(candidate);
    if (!age) {
      throw new Error('Missing age for neo-therapy priest recovery test.');
    }
    age.ticksAlive = 2;

    const system = new NeoTherapySystem();
    system.update(world);
    expect(world.neoTherapy.get(candidate)?.target).toBe('Priest');

    system.update(world);
    expect(world.neoTherapy.has(candidate)).toBe(false);
    expect(world.ranks.get(candidate)?.rank).toBe(Rank.Priest);
    expect(world.shapes.get(candidate)?.kind).toBe('circle');
  });
});
