import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
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
});
