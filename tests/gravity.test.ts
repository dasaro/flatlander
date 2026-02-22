import { describe, expect, it } from 'vitest';

import { spawnFromRequest } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { SouthAttractionSystem } from '../src/systems/southAttractionSystem';

describe('south attraction drift dynamics', () => {
  it('approaches terminal drift and respects max terminal cap', () => {
    const world = createWorld(7, {
      southAttractionEnabled: true,
      southAttractionStrength: 6,
      southAttractionWomenMultiplier: 1,
      southAttractionZoneStartFrac: 0.75,
      southAttractionZoneEndFrac: 0.95,
      southAttractionDrag: 12,
      southAttractionMaxTerminal: 1,
    });

    const ids = spawnFromRequest(world, {
      shape: {
        kind: 'circle',
        size: 12,
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
      throw new Error('Failed to create entity for drift test.');
    }

    const transform = world.transforms.get(id);
    if (!transform) {
      throw new Error('Entity transform missing for drift test.');
    }
    transform.position.y = world.config.height - 1;

    const system = new SouthAttractionSystem();
    const dt = 1 / world.config.tickRate;
    for (let i = 0; i < 900; i += 1) {
      system.update(world, dt);
    }

    const driftVy = world.southDrifts.get(id)?.vy ?? 0;
    const expectedTerminal = world.config.southAttractionStrength / world.config.southAttractionDrag;

    expect(driftVy).toBeCloseTo(expectedTerminal, 2);
    expect(driftVy).toBeLessThanOrEqual(world.config.southAttractionMaxTerminal + 1e-9);
  });

  it('default settings keep drift subtle relative to movement speeds', () => {
    const world = createWorld(12);

    spawnFromRequest(world, {
      shape: {
        kind: 'segment',
        size: 24,
      },
      movement: {
        type: 'randomWalk',
        speed: 30,
        turnRate: 2,
        boundary: 'wrap',
      },
      count: 30,
    });

    spawnFromRequest(world, {
      shape: {
        kind: 'polygon',
        sides: 6,
        size: 20,
        irregular: false,
      },
      movement: {
        type: 'randomWalk',
        speed: 30,
        turnRate: 2,
        boundary: 'wrap',
      },
      count: 30,
    });

    const system = new SouthAttractionSystem();
    const dt = 1 / world.config.tickRate;
    for (let i = 0; i < 240; i += 1) {
      system.update(world, dt);
    }

    const drifts = [...world.southDrifts.values()].map((entry) => Math.abs(entry.vy));
    const meanAbsDrift = drifts.reduce((sum, value) => sum + value, 0) / drifts.length;

    expect(meanAbsDrift).toBeLessThan(1);
  });
});
