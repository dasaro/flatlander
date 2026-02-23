import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { MovementSystem } from '../src/systems/movementSystem';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../src/systems/socialNavSteeringSystem';

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) {
    value -= Math.PI * 2;
  }
  while (value < -Math.PI) {
    value += Math.PI * 2;
  }
  return value;
}

describe('social nav movement', () => {
  it('limits heading changes by configured turn rate', () => {
    const world = createWorld(401, {
      southAttractionEnabled: false,
    });
    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 12,
        maxTurnRate: 0.9,
        decisionEveryTicks: 5,
        intentionMinTicks: 20,
      },
      { x: 320, y: 180 },
    );

    spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 14,
        maxTurnRate: 1.2,
        decisionEveryTicks: 6,
        intentionMinTicks: 24,
      },
      { x: 360, y: 180 },
    );

    const simulation = new FixedTimestepSimulation(world, [
      new SocialNavMindSystem(),
      new SocialNavSteeringSystem(),
      new MovementSystem(),
    ]);

    const tickDt = 1 / world.config.tickRate;
    const initialMovement = world.movements.get(id);
    let previousHeading =
      initialMovement && initialMovement.type === 'socialNav' ? initialMovement.heading : 0;
    for (let i = 0; i < 120; i += 1) {
      simulation.stepOneTick();
      const movement = world.movements.get(id);
      if (!movement || movement.type !== 'socialNav') {
        continue;
      }
      const delta = Math.abs(normalizeAngle(movement.heading - previousHeading));
      expect(delta).toBeLessThanOrEqual(movement.maxTurnRate * tickDt + 1e-6);
      previousHeading = movement.heading;
    }
  });

  it('is deterministic with fixed seed and setup', () => {
    const build = (): string => {
      const world = createWorld(402, {
        southAttractionEnabled: false,
      });
      spawnEntity(
        world,
        { kind: 'segment', size: 20 },
        {
          type: 'socialNav',
          boundary: 'wrap',
          maxSpeed: 14,
          maxTurnRate: 1.25,
          decisionEveryTicks: 7,
          intentionMinTicks: 30,
        },
        { x: 220, y: 220 },
      );
      spawnEntity(
        world,
        { kind: 'polygon', sides: 3, size: 17, irregular: false, triangleKind: 'Isosceles', isoscelesBaseRatio: 0.08 },
        {
          type: 'socialNav',
          boundary: 'wrap',
          maxSpeed: 16,
          maxTurnRate: 1.3,
          decisionEveryTicks: 6,
          intentionMinTicks: 28,
        },
        { x: 260, y: 220 },
      );

      const simulation = new FixedTimestepSimulation(world, [
        new SocialNavMindSystem(),
        new SocialNavSteeringSystem(),
        new MovementSystem(),
      ]);

      for (let i = 0; i < 180; i += 1) {
        simulation.stepOneTick();
      }

      const rows = [...world.entities]
        .sort((a, b) => a - b)
        .map((id) => {
          const movement = world.movements.get(id);
          const transform = world.transforms.get(id);
          return {
            id,
            x: Number((transform?.position.x ?? 0).toFixed(6)),
            y: Number((transform?.position.y ?? 0).toFixed(6)),
            heading: Number((movement && movement.type !== 'straightDrift' ? movement.heading : 0).toFixed(6)),
            type: movement?.type ?? 'missing',
          };
        });
      return JSON.stringify(rows);
    };

    expect(build()).toBe(build());
  });

  it('chooses intentions from perceived 1D vision hits, not omniscient neighbor scans', () => {
    const world = createWorld(403, {
      southAttractionEnabled: false,
      sightEnabled: false,
    });
    const observerId = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 14,
        maxTurnRate: 1.25,
        decisionEveryTicks: 4,
        intentionMinTicks: 18,
      },
      { x: 220, y: 220 },
    );
    spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      {
        type: 'socialNav',
        boundary: 'wrap',
        maxSpeed: 12,
        maxTurnRate: 1.1,
        decisionEveryTicks: 4,
        intentionMinTicks: 18,
      },
      { x: 235, y: 220 },
    );

    const movement = world.movements.get(observerId);
    if (!movement || movement.type !== 'socialNav') {
      throw new Error('Observer social-nav component missing in perception-only test.');
    }
    movement.intentionTicksLeft = 0;

    const mind = new SocialNavMindSystem();
    mind.update(world);

    const nextMovement = world.movements.get(observerId);
    expect(nextMovement && nextMovement.type === 'socialNav' ? nextMovement.intention : null).toBe('roam');
  });
});
