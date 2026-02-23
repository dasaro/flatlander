import { describe, expect, it } from 'vitest';

import { geometryFromComponents } from '../src/core/entityGeometry';
import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { ErosionSystem } from '../src/systems/erosionSystem';

describe('erosion system', () => {
  it('applies deterministic wear from sustained sliding contact', () => {
    const world = createWorld(610, {
      wearEnabled: true,
      wearRate: 0.4,
      wearToHpStep: 3,
      southAttractionEnabled: false,
    });

    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 8, boundary: 'wrap' },
      { x: 200, y: 200 },
    );
    const b = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: -8, boundary: 'wrap' },
      { x: 200, y: 200 },
    );

    const shapeA = world.shapes.get(a);
    const shapeB = world.shapes.get(b);
    const transformA = world.transforms.get(a);
    const transformB = world.transforms.get(b);
    if (!shapeA || !shapeB || !transformA || !transformB) {
      throw new Error('Missing setup components for erosion test.');
    }

    world.geometries.set(a, geometryFromComponents(shapeA, transformA));
    world.geometries.set(b, geometryFromComponents(shapeB, transformB));
    world.manifolds = [
      {
        aId: a,
        bId: b,
        normal: { x: 1, y: 0 },
        penetration: 0.8,
        contactPoint: { x: 200, y: 200 },
        featureA: { kind: 'edge' },
        featureB: { kind: 'edge' },
        closingSpeed: 0,
      },
    ];

    const durabilityA = world.durability.get(a);
    if (!durabilityA) {
      throw new Error('Missing durability on entity a.');
    }
    const hpBefore = durabilityA.hp;
    const erosion = new ErosionSystem();
    for (let i = 0; i < 220; i += 1) {
      erosion.update(world, 1 / 30);
    }

    expect((world.durability.get(a)?.hp ?? hpBefore) < hpBefore).toBe(true);
  });

  it('applies more direct damage for vertex contact than edge contact', () => {
    const buildDamage = (featureKind: 'vertex' | 'edge'): number => {
      const world = createWorld(611, {
        wearEnabled: true,
        wearRate: 0.1,
        wearToHpStep: 10,
        stabHpDamageScale: 1.4,
        southAttractionEnabled: false,
      });
      const attacker = spawnEntity(
        world,
        { kind: 'polygon', sides: 3, size: 18, irregular: false, triangleKind: 'Isosceles', isoscelesBaseRatio: 0.06 },
        { type: 'straightDrift', vx: 12, vy: 0, boundary: 'wrap' },
        { x: 150, y: 150 },
      );
      const victim = spawnEntity(
        world,
        { kind: 'polygon', sides: 4, size: 18, irregular: false },
        { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
        { x: 150, y: 150 },
      );

      const shapeA = world.shapes.get(attacker);
      const shapeB = world.shapes.get(victim);
      const transformA = world.transforms.get(attacker);
      const transformB = world.transforms.get(victim);
      if (!shapeA || !shapeB || !transformA || !transformB) {
        throw new Error('Missing setup components for erosion damage test.');
      }

      world.geometries.set(attacker, geometryFromComponents(shapeA, transformA));
      world.geometries.set(victim, geometryFromComponents(shapeB, transformB));
      world.manifolds = [
        {
          aId: attacker,
          bId: victim,
          normal: { x: 1, y: 0 },
          penetration: 0.6,
          contactPoint: { x: 150, y: 150 },
          featureA: featureKind === 'vertex' ? { kind: 'vertex', index: 2 } : { kind: 'edge' },
          featureB: { kind: 'edge' },
          closingSpeed: 10,
        },
      ];

      const hpBefore = world.durability.get(victim)?.hp ?? 0;
      new ErosionSystem().update(world, 1 / 30);
      const hpAfter = world.durability.get(victim)?.hp ?? hpBefore;
      return hpBefore - hpAfter;
    };

    const vertexDamage = buildDamage('vertex');
    const edgeDamage = buildDamage('edge');
    expect(vertexDamage).toBeGreaterThan(edgeDamage);
  });
});
