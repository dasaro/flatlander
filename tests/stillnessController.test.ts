import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { requestStillness } from '../src/core/stillness';
import { createWorld } from '../src/core/world';
import { MovementSystem } from '../src/systems/movementSystem';
import { StillnessControllerSystem } from '../src/systems/stillnessControllerSystem';

describe('stillness controller', () => {
  it('full stillness overrides translation and rotation updates', () => {
    const world = createWorld(910, {
      southAttractionEnabled: false,
    });
    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'randomWalk', speed: 14, turnRate: 2.5, boundary: 'wrap' },
      { x: 220, y: 180 },
    );

    const start = world.transforms.get(id);
    if (!start) {
      throw new Error('Missing transform in stillness override test.');
    }

    const startPos = { ...start.position };
    const startRot = start.rotation;
    requestStillness(world, {
      entityId: id,
      mode: 'full',
      reason: 'manual',
      ticksRemaining: 4,
      requestedBy: null,
    });

    const stillness = new StillnessControllerSystem();
    const movement = new MovementSystem();
    const dt = 1 / world.config.tickRate;

    for (let tick = 0; tick < 4; tick += 1) {
      world.tick += 1;
      stillness.update(world);
      movement.update(world, dt);
      const now = world.transforms.get(id);
      expect(now?.position.x).toBeCloseTo(startPos.x, 8);
      expect(now?.position.y).toBeCloseTo(startPos.y, 8);
      expect(now?.rotation).toBeCloseTo(startRot, 8);
    }

    // Exact duration semantics: N requested ticks stay active for exactly N movement ticks.
    world.tick += 1;
    stillness.update(world);
    movement.update(world, dt);
    const after = world.transforms.get(id);
    expect(after).toBeDefined();
    const moved =
      Math.abs((after?.position.x ?? startPos.x) - startPos.x) +
      Math.abs((after?.position.y ?? startPos.y) - startPos.y);
    expect(moved).toBeGreaterThan(0);
  });

  it('resolves request conflicts by reason priority then requester id', () => {
    const world = createWorld(911);
    const id = spawnEntity(
      world,
      { kind: 'circle', size: 10 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );

    requestStillness(world, {
      entityId: id,
      mode: 'translation',
      reason: 'manual',
      ticksRemaining: 10,
      requestedBy: null,
    });
    requestStillness(world, {
      entityId: id,
      mode: 'full',
      reason: 'beingFelt',
      ticksRemaining: 4,
      requestedBy: 7,
    });
    requestStillness(world, {
      entityId: id,
      mode: 'full',
      reason: 'beingFelt',
      ticksRemaining: 8,
      requestedBy: 3,
    });

    const stillness = new StillnessControllerSystem();
    stillness.update(world);

    const active = world.stillness.get(id);
    expect(active).toBeDefined();
    expect(active?.reason).toBe('beingFelt');
    expect(active?.mode).toBe('full');
    expect(active?.requestedBy).toBe(3);
    expect(active?.ticksRemaining).toBe(8);
  });

  it('expires at tick zero (no off-by-one)', () => {
    const world = createWorld(912, {
      southAttractionEnabled: false,
    });
    const id = spawnEntity(
      world,
      { kind: 'segment', size: 18 },
      { type: 'straightDrift', vx: 2, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    const stillness = new StillnessControllerSystem();
    const movement = new MovementSystem();
    const dt = 1 / world.config.tickRate;

    requestStillness(world, {
      entityId: id,
      mode: 'full',
      reason: 'manual',
      ticksRemaining: 2,
      requestedBy: null,
    });

    const startX = world.transforms.get(id)?.position.x ?? 0;
    for (let tick = 0; tick < 2; tick += 1) {
      world.tick += 1;
      stillness.update(world);
      movement.update(world, dt);
      expect(world.stillness.has(id)).toBe(true);
      const x = world.transforms.get(id)?.position.x ?? 0;
      expect(x).toBeCloseTo(startX, 8);
    }

    world.tick += 1;
    stillness.update(world);
    movement.update(world, dt);
    expect(world.stillness.has(id)).toBe(false);
    const movedX = world.transforms.get(id)?.position.x ?? 0;
    expect(movedX).toBeGreaterThan(startX);
  });
});
