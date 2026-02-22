import { describe, expect, it } from 'vitest';

import { spawnFromRequest } from '../src/core/factory';
import { createWorld } from '../src/core/world';

describe('triangle metadata propagation', () => {
  it('preserves isosceles triangle kind and base ratio from spawn request', () => {
    const world = createWorld(17);
    const ratio = 0.23;

    const ids = spawnFromRequest(world, {
      shape: {
        kind: 'polygon',
        sides: 3,
        size: 22,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: ratio,
      },
      movement: {
        type: 'straightDrift',
        vx: 0,
        vy: 0,
        boundary: 'wrap',
      },
      count: 1,
    });

    const id = ids[0];
    if (id === undefined) {
      throw new Error('Failed to spawn test entity.');
    }

    const shape = world.shapes.get(id);
    if (!shape || shape.kind !== 'polygon') {
      throw new Error('Expected polygon shape.');
    }

    expect(shape.triangleKind).toBe('Isosceles');
    expect(shape.isoscelesBaseRatio).toBeCloseTo(ratio, 8);
  });
});
