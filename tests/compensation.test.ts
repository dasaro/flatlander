import { describe, expect, it } from 'vitest';

import { spawnEntity, spawnFromRequest } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { minimumInternalAngle } from '../src/geometry/polygon';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { CompensationSystem } from '../src/systems/compensationSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';

function sharpnessFromVertices(vertices: Array<{ x: number; y: number }>): number {
  const minAngle = minimumInternalAngle(vertices);
  return (Math.PI - minAngle) / Math.PI;
}

describe('law of compensation', () => {
  it('widens isosceles base ratio monotonically and lowers sharpness', () => {
    const world = createWorld(101, {
      compensationEnabled: true,
      compensationRate: 1.2,
      southAttractionEnabled: false,
    });

    const [id] = spawnFromRequest(world, {
      shape: {
        kind: 'polygon',
        sides: 3,
        size: 22,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.08,
      },
      movement: {
        type: 'straightDrift',
        vx: 0,
        vy: 0,
        boundary: 'wrap',
      },
      count: 1,
    });

    if (id === undefined) {
      throw new Error('Failed to spawn isosceles triangle for compensation test.');
    }

    const intelligence = world.intelligence.get(id);
    if (!intelligence) {
      throw new Error('Missing intelligence component in compensation test.');
    }
    intelligence.value = 1;

    const system = new CompensationSystem();
    const ratios: number[] = [];
    const sharpnesses: number[] = [];

    for (let i = 0; i < 20; i += 1) {
      system.update(world, 1 / world.config.tickRate);
      const shape = world.shapes.get(id);
      if (!shape || shape.kind !== 'polygon' || shape.sides !== 3 || shape.isoscelesBaseRatio === undefined) {
        throw new Error('Invalid triangle state in compensation monotonic test.');
      }

      ratios.push(shape.isoscelesBaseRatio);
      sharpnesses.push(sharpnessFromVertices(shape.vertices));
    }

    for (let i = 1; i < ratios.length; i += 1) {
      const prev = ratios[i - 1] ?? 0;
      const next = ratios[i] ?? prev;
      expect(next + 1e-9).toBeGreaterThanOrEqual(prev);

      const prevSharp = sharpnesses[i - 1] ?? 0;
      const nextSharp = sharpnesses[i] ?? prevSharp;
      expect(nextSharp).toBeLessThanOrEqual(prevSharp + 1e-9);
    }
  });

  it('reduces potential stab severity for acute isosceles attackers', () => {
    const runScenario = (enabled: boolean): number => {
      const world = createWorld(1337, {
        compensationEnabled: enabled,
        compensationRate: 1.2,
        intelligenceGrowthPerSecond: 0,
        handshakeIntelligenceBonus: 0,
        killThreshold: 12,
        killSeverityThreshold: 6.5,
        pressureTicksToKill: 80,
        feelSpeedThreshold: 4,
        southAttractionEnabled: false,
        reproductionEnabled: false,
      });

      const attackerId = spawnEntity(
        world,
        {
          kind: 'polygon',
          sides: 3,
          size: 22,
          irregular: false,
          triangleKind: 'Isosceles',
          isoscelesBaseRatio: 0.05,
        },
        {
          type: 'straightDrift',
          vx: 14,
          vy: 0,
          boundary: 'wrap',
        },
        { x: 200, y: 200 },
      );

      const victimId = spawnEntity(
        world,
        {
          kind: 'polygon',
          sides: 4,
          size: 18,
          irregular: false,
        },
        {
          type: 'straightDrift',
          vx: 0,
          vy: 0,
          boundary: 'wrap',
        },
        { x: 210, y: 200 },
      );

      const attackerIntelligence = world.intelligence.get(attackerId);
      if (attackerIntelligence) {
        attackerIntelligence.value = 1;
      }

      const attackerTransform = world.transforms.get(attackerId);
      const victimTransform = world.transforms.get(victimId);
      if (attackerTransform) {
        attackerTransform.rotation = 0;
      }
      if (victimTransform) {
        victimTransform.rotation = 0;
      }

      const compensation = new CompensationSystem();
      if (enabled) {
        for (let i = 0; i < 240; i += 1) {
          compensation.update(world, 1 / world.config.tickRate);
        }
      }

      const collision = new CollisionSystem();
      const lethality = new LethalitySystem();
      const cleanup = new CleanupSystem();

      world.tick = 1;
      collision.update(world);
      const manifold = world.manifolds[0];
      if (!manifold) {
        throw new Error('Expected a collision manifold in compensation severity test.');
      }

      const attackerShape = world.geometries.get(attackerId);
      if (!attackerShape || attackerShape.kind !== 'polygon') {
        throw new Error('Expected attacker polygon geometry in compensation severity test.');
      }

      const sharpness = sharpnessFromVertices(attackerShape.vertices);
      const severity = sharpness * manifold.closingSpeed;
      lethality.update(world);
      cleanup.update(world);

      return severity;
    };

    const withoutComp = runScenario(false);
    const withComp = runScenario(true);
    expect(withComp).toBeLessThan(withoutComp);
  });
});
