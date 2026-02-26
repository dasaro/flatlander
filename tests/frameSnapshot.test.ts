import { describe, expect, it } from 'vitest';

import { createWorld } from '../src/core/world';
import { captureFrameSnapshot } from '../src/ui/frameSnapshot';

describe('frame snapshot', () => {
  it('captures a stable immutable rain/fog snapshot from world + UI state', () => {
    const world = createWorld(42, {
      housesEnabled: true,
      rainEnabled: true,
      fogDensity: 0.013,
    });
    world.tick = 123;
    world.weather.isRaining = true;

    const snapshot = captureFrameSnapshot(world, {
      showRainOverlay: true,
      showFogOverlay: false,
    });

    expect(snapshot.tick).toBe(123);
    expect(snapshot.isRaining).toBe(true);
    expect(snapshot.fogDensity).toBeCloseTo(0.013, 8);
    expect(snapshot.fogField.baseDensity).toBeCloseTo(0.013, 8);
    expect(snapshot.fogField.seed).toBe(42);
    expect(snapshot.showRainOverlay).toBe(true);
    expect(snapshot.showFogOverlay).toBe(false);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.fogField)).toBe(true);
  });
});
