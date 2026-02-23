import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { FeelingSystem } from '../src/systems/feelingSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { StillnessSystem } from '../src/systems/stillnessSystem';

describe('handshake stillness protocol', () => {
  it('keeps both entities still for configured handshake ticks', () => {
    const world = createWorld(71, {
      handshakeStillnessTicks: 3,
      feelSpeedThreshold: 12,
      southAttractionEnabled: false,
    });

    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      { type: 'straightDrift', vx: 1.5, vy: 0, boundary: 'wrap' },
      { x: 200, y: 200 },
    );
    const manId = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 16, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 200, y: 200 },
    );

    const collision = new CollisionSystem();
    const feeling = new FeelingSystem();
    const stillness = new StillnessSystem();
    const movement = new MovementSystem();

    world.tick = 1;
    collision.update(world);
    feeling.update(world, 1 / world.config.tickRate);

    expect(world.stillness.has(womanId)).toBe(true);
    expect(world.stillness.has(manId)).toBe(true);

    const womanStart = world.transforms.get(womanId)?.position;
    const manStart = world.transforms.get(manId)?.position;
    if (!womanStart || !manStart) {
      throw new Error('Missing transforms in stillness protocol test.');
    }

    for (let i = 0; i < 3; i += 1) {
      world.tick += 1;
      stillness.update(world, 1 / world.config.tickRate);
      movement.update(world, 1);

      const womanNow = world.transforms.get(womanId)?.position;
      const manNow = world.transforms.get(manId)?.position;
      expect(womanNow?.x).toBeCloseTo(womanStart.x, 6);
      expect(womanNow?.y).toBeCloseTo(womanStart.y, 6);
      expect(manNow?.x).toBeCloseTo(manStart.x, 6);
      expect(manNow?.y).toBeCloseTo(manStart.y, 6);
    }

    world.tick += 1;
    stillness.update(world, 1 / world.config.tickRate);
    movement.update(world, 1);

    const womanAfter = world.transforms.get(womanId)?.position;
    expect(womanAfter?.x).toBeGreaterThan(womanStart.x);
  });
});
