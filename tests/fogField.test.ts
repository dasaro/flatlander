import { describe, expect, it } from 'vitest';

import { fogDensityAt, fogFieldConfigFromWorld } from '../src/core/fogField';
import { createWorld } from '../src/core/world';

describe('fog field', () => {
  it('is deterministic for same seed and position', () => {
    const worldA = createWorld(42, {
      fogDensity: 0.012,
      fogFieldCellSize: 80,
      fogFieldVariation: 0.5,
    });
    const worldB = createWorld(42, {
      fogDensity: 0.012,
      fogFieldCellSize: 80,
      fogFieldVariation: 0.5,
    });
    const cfgA = fogFieldConfigFromWorld(worldA);
    const cfgB = fogFieldConfigFromWorld(worldB);
    const pos = { x: 312.4, y: 441.2 };
    expect(fogDensityAt(cfgA, pos)).toBeCloseTo(fogDensityAt(cfgB, pos), 10);
  });

  it('stays within expected bounded range from base density and variation', () => {
    const world = createWorld(7, {
      fogDensity: 0.01,
      fogFieldVariation: 0.4,
      fogTorridZoneRelief: 0.3,
    });
    const cfg = fogFieldConfigFromWorld(world);
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (let y = 0; y <= world.config.height; y += 70) {
      for (let x = 0; x <= world.config.width; x += 70) {
        const density = fogDensityAt(cfg, { x, y });
        min = Math.min(min, density);
        max = Math.max(max, density);
      }
    }
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(world.config.fogDensity * (1 + world.config.fogFieldVariation) + 1e-6);
  });

  it('applies torrid-zone relief in southern region', () => {
    const world = createWorld(101, {
      fogDensity: 0.013,
      fogFieldVariation: 0,
      fogTorridZoneStartFrac: 0.65,
      fogTorridZoneRelief: 0.45,
    });
    const cfg = fogFieldConfigFromWorld(world);
    const north = fogDensityAt(cfg, { x: world.config.width * 0.4, y: world.config.height * 0.2 });
    const south = fogDensityAt(cfg, { x: world.config.width * 0.4, y: world.config.height * 0.95 });
    expect(north).toBeGreaterThan(south);
  });
});

