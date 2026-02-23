import { describe, expect, it } from 'vitest';

import {
  ageAlphaFactor,
  durabilityAlphaFactor,
  fogIntensityAtDistance,
  fogRingRadiusForLevel,
  visualAlpha,
} from '../src/render/viewModifiers';

describe('view modifiers', () => {
  it('produces clamped, monotone alpha for age and durability', () => {
    const young = visualAlpha({
      ticksAlive: 0,
      hp: 50,
      maxHp: 50,
      dimByAge: true,
      dimByDeterioration: true,
      strength: 0.5,
      ageHalfLifeTicks: 4_000,
    });
    const old = visualAlpha({
      ticksAlive: 8_000,
      hp: 50,
      maxHp: 50,
      dimByAge: true,
      dimByDeterioration: true,
      strength: 0.5,
      ageHalfLifeTicks: 4_000,
    });
    const worn = visualAlpha({
      ticksAlive: 8_000,
      hp: 5,
      maxHp: 50,
      dimByAge: true,
      dimByDeterioration: true,
      strength: 0.5,
      ageHalfLifeTicks: 4_000,
    });

    expect(young).toBeGreaterThanOrEqual(old);
    expect(old).toBeGreaterThanOrEqual(worn);
    expect(worn).toBeGreaterThanOrEqual(0.05);
    expect(young).toBeLessThanOrEqual(1);

    expect(ageAlphaFactor(0, 0.4, 4_000)).toBeGreaterThan(ageAlphaFactor(8_000, 0.4, 4_000));
    expect(durabilityAlphaFactor(50, 50, 0.5)).toBeGreaterThan(durabilityAlphaFactor(5, 50, 0.5));
  });

  it('fog intensity and rings are distance-consistent', () => {
    const density = 0.006;
    const maxDistance = 450;

    const near = fogIntensityAtDistance(50, density, maxDistance);
    const far = fogIntensityAtDistance(300, density, maxDistance);
    expect(near).toBeGreaterThan(far);

    expect(fogIntensityAtDistance(100, 0, maxDistance)).toBe(1);

    const level = 0.5;
    const radius = fogRingRadiusForLevel(level, density, maxDistance);
    expect(radius).not.toBeNull();
    if (radius !== null) {
      const reconstructed = fogIntensityAtDistance(radius, density, maxDistance);
      expect(Math.abs(reconstructed - level)).toBeLessThan(0.02);
    }
  });
});
