import { describe, expect, it } from 'vitest';

import { spawnFromRequest } from '../src/core/factory';
import { Rank } from '../src/core/rank';
import { createWorld } from '../src/core/world';
import { RegularizationSystem } from '../src/systems/regularizationSystem';

describe('irregular regularization', () => {
  it('regularizes an irregular polygon deterministically and upgrades rank', () => {
    const world = createWorld(4242, {
      regularizationEnabled: true,
      regularizationRate: 0.5,
      regularityTolerance: 0.012,
      southAttractionEnabled: false,
      reproductionEnabled: false,
    });

    const [id] = spawnFromRequest(world, {
      shape: {
        kind: 'polygon',
        sides: 6,
        size: 22,
        irregular: true,
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
      throw new Error('Failed to spawn irregular polygon for regularization test.');
    }

    const intelligence = world.intelligence.get(id);
    if (!intelligence) {
      throw new Error('Missing intelligence component in regularization test.');
    }
    intelligence.value = 1;

    const regularization = new RegularizationSystem();
    const deviations: number[] = [];
    let upgradedTick: number | null = null;
    for (let i = 0; i < 200; i += 1) {
      world.tick += 1;
      regularization.update(world, 1 / world.config.tickRate);
      const current = world.irregularity.get(id)?.deviation ?? 0;
      deviations.push(current);
      const currentShape = world.shapes.get(id);
      const isRegularPolygon = currentShape?.kind === 'polygon' && !(currentShape.irregular ?? false);
      if (isRegularPolygon || current === 0) {
        upgradedTick = world.tick;
        break;
      }
    }

    for (let i = 1; i < deviations.length; i += 1) {
      expect((deviations[i] ?? 0) - 1e-9).toBeLessThanOrEqual(deviations[i - 1] ?? 0);
    }

    const shape = world.shapes.get(id);
    const rank = world.ranks.get(id);
    expect(upgradedTick).not.toBeNull();
    expect(shape?.kind).toBe('polygon');
    if (!shape || shape.kind !== 'polygon') {
      throw new Error('Expected polygon shape after regularization.');
    }

    expect(shape.irregular ?? false).toBe(false);
    expect(world.irregularity.has(id)).toBe(false);
    expect(rank?.rank).toBe(Rank.Noble);
  });
});
