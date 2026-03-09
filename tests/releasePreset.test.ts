import { describe, expect, it } from 'vitest';

import { boundaryFromTopology } from '../src/core/topology';
import { defaultSpawnPlan, defaultWorldConfig } from '../src/presets/defaultScenario';
import {
  createReleaseSpawnPlan,
  createReleaseUiDefaults,
  createReleaseWorldConfig,
  createReleaseWorldConfigFromUiSettings,
  RELEASE_PRESET_ID,
} from '../src/presets/releasePreset';

describe('release preset', () => {
  it('backs the shipped default scenario exports', () => {
    const boundary = boundaryFromTopology('torus');

    expect(defaultSpawnPlan(boundary)).toEqual(createReleaseSpawnPlan(boundary));
    expect(defaultWorldConfig('torus')).toEqual(createReleaseWorldConfig('torus'));
  });

  it('round-trips release UI defaults through the release config merge helper', () => {
    const ui = createReleaseUiDefaults();
    const merged = createReleaseWorldConfigFromUiSettings(
      'torus',
      ui.southAttraction,
      ui.environment,
      ui.peaceCry,
      ui.reproduction,
      ui.fogSight,
    );
    const release = createReleaseWorldConfig('torus');

    expect(merged).toMatchObject(release);
    expect(merged.houseMinSpacing).toBe(Math.round(ui.environment.houseSize * 0.35));
  });

  it('declares an explicit canonical release preset id', () => {
    expect(RELEASE_PRESET_ID).toMatch(/^v1-canonical-/);
  });
});
