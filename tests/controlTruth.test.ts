import { describe, expect, it } from 'vitest';

import {
  describeEnvironmentControlTruth,
  describeFlatlanderControlTruth,
  describeOverlayControlTruth,
  describePeaceCryControlTruth,
  describeReproductionControlTruth,
} from '../src/ui/controlTruth';

describe('controlTruth', () => {
  it('explains square-house suppression in large towns', () => {
    const truth = describeEnvironmentControlTruth({
      housesEnabled: true,
      rainEnabled: true,
      townPopulation: 10_000,
    });

    expect(truth.houseGeneration.enabled).toBe(true);
    expect(truth.squareHouses.enabled).toBe(false);
    expect(truth.squareHouses.disabledReason).toContain('10,000');
  });

  it('gates selection-only overlays until an entity is selected', () => {
    const truth = describeOverlayControlTruth(
      {
        enabled: true,
        showHearingOverlay: true,
        showContactNetwork: true,
        fogPreviewEnabled: true,
      },
      false,
    );

    expect(truth.focusSelected.enabled).toBe(false);
    expect(truth.hearing.enabled).toBe(false);
    expect(truth.contactNetwork.enabled).toBe(false);
    expect(truth.fogPreview.enabled).toBe(false);
    expect(truth.hearing.disabledReason).toContain('Select an entity');
  });

  it('gates dependent peace-cry and reproduction sub-controls by their master toggles', () => {
    const peaceCry = describePeaceCryControlTruth({
      enabled: true,
      strictComplianceEnabled: false,
      northYieldEnabled: false,
      rainCurfewEnabled: false,
    });
    const reproduction = describeReproductionControlTruth({
      enabled: true,
      irregularBirthsEnabled: false,
      priestMediationEnabled: false,
    });

    expect(peaceCry.complianceStillness.enabled).toBe(false);
    expect(peaceCry.northYieldRadius.enabled).toBe(false);
    expect(peaceCry.rainCurfewGrace.enabled).toBe(false);
    expect(reproduction.irregularBaseChance.enabled).toBe(false);
    expect(reproduction.priestMediationRadius.enabled).toBe(false);
    expect(reproduction.priestMediationBias.enabled).toBe(false);
  });

  it('disables flatlander boundary silhouettes on torus topology', () => {
    const torus = describeFlatlanderControlTruth({ enabled: true }, 'torus');
    const bounded = describeFlatlanderControlTruth({ enabled: true }, 'bounded');

    expect(torus.includeBoundaries.enabled).toBe(false);
    expect(torus.includeBoundaries.disabledReason).toContain('bounded');
    expect(bounded.includeBoundaries.enabled).toBe(true);
  });
});
