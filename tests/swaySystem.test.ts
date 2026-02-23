import { describe, expect, it } from 'vitest';

import { defaultSwayForFemaleRank } from '../src/core/femaleStatus';
import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { SwaySystem } from '../src/systems/swaySystem';

describe('women back-motion sway', () => {
  it('evolves sway deterministically with fixed dt and phase', () => {
    const makeRotations = () => {
      const world = createWorld(305);
      const womanId = spawnEntity(
        world,
        { kind: 'segment', size: 24 },
        { type: 'randomWalk', speed: 0, turnRate: 0, boundary: 'wrap' },
        { x: 100, y: 100 },
      );

      const movement = world.movements.get(womanId);
      const sway = world.sway.get(womanId);
      if (!movement || movement.type === 'straightDrift' || !sway) {
        throw new Error('Missing woman movement/sway in deterministic sway test.');
      }
      movement.heading = 0;
      sway.phase = 0;

      const system = new SwaySystem();
      const dt = 1 / world.config.tickRate;
      const rotations: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        system.update(world, dt);
        const rotation = world.transforms.get(womanId)?.rotation ?? 0;
        rotations.push(Number(rotation.toFixed(8)));
      }

      return rotations;
    };

    expect(makeRotations()).toEqual(makeRotations());
  });

  it('high female rank yields stronger/modulated sway than low rank', () => {
    const world = createWorld(306);
    const lowId = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'randomWalk', speed: 0, turnRate: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    const highId = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'randomWalk', speed: 0, turnRate: 0, boundary: 'wrap' },
      { x: 150, y: 100 },
    );

    const lowMovement = world.movements.get(lowId);
    const highMovement = world.movements.get(highId);
    if (
      !lowMovement ||
      !highMovement ||
      lowMovement.type === 'straightDrift' ||
      highMovement.type === 'straightDrift'
    ) {
      throw new Error('Missing movements in sway rank test.');
    }
    lowMovement.heading = 0;
    highMovement.heading = 0;

    world.femaleStatus.set(lowId, { femaleRank: 'Low' });
    world.femaleStatus.set(highId, { femaleRank: 'High' });
    world.sway.set(lowId, { ...defaultSwayForFemaleRank('Low'), phase: 0 });
    world.sway.set(highId, { ...defaultSwayForFemaleRank('High'), phase: 0 });

    const system = new SwaySystem();
    const dt = 1 / world.config.tickRate;
    system.update(world, dt);

    const lowOffset = Math.abs((world.transforms.get(lowId)?.rotation ?? 0) - lowMovement.heading);
    const highOffset = Math.abs((world.transforms.get(highId)?.rotation ?? 0) - highMovement.heading);
    expect(highOffset).toBeGreaterThan(lowOffset);
  });
});
