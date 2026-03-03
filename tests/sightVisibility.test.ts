import { describe, expect, it } from 'vitest';

import {
  effectiveSightSignal,
  sampleVisibleToSight,
  type SightVisibilityContext,
} from '../src/core/perception/sightVisibility';

describe('sight visibility helpers', () => {
  const dimnessContext: SightVisibilityContext = {
    hasDimnessCue: true,
    sightSkill: 0.6,
    fogMinIntensity: 0.2,
  };

  it('scales signal by sight skill when dimness cue exists', () => {
    expect(effectiveSightSignal(1, dimnessContext)).toBeCloseTo(0.6, 9);
    expect(effectiveSightSignal(0.5, dimnessContext)).toBeCloseTo(0.3, 9);
  });

  it('uses sight skill only when dimness cue is absent', () => {
    const fogFreeContext: SightVisibilityContext = {
      hasDimnessCue: false,
      sightSkill: 0.35,
      fogMinIntensity: 0.2,
    };
    expect(effectiveSightSignal(0.1, fogFreeContext)).toBeCloseTo(0.35, 9);
    expect(effectiveSightSignal(1, fogFreeContext)).toBeCloseTo(0.35, 9);
  });

  it('applies threshold gating consistently', () => {
    expect(sampleVisibleToSight(0.45, dimnessContext)).toBe(true);
    expect(sampleVisibleToSight(0.2, dimnessContext)).toBe(false);
  });
});
