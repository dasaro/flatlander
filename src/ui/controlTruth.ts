import type { WorldTopology } from '../core/topology';

export interface Availability {
  enabled: boolean;
  disabledReason?: string;
  enabledHint?: string;
}

export interface EnvironmentControlTruth {
  houseGeneration: Availability;
  squareHouses: Availability;
  rainEnabled: Availability;
  rainOverlay: Availability;
  houseDoors: Availability;
  houseOccupancy: Availability;
}

export interface PeaceCryControlTruth {
  cadence: Availability;
  radius: Availability;
  complianceStillness: Availability;
  northYieldRadius: Availability;
  rainCurfewGrace: Availability;
  applyAll: Availability;
}

export interface ReproductionControlTruth {
  gestation: Availability;
  matingRadius: Availability;
  conceptionChance: Availability;
  femaleBirthProbability: Availability;
  maxPopulation: Availability;
  irregularBaseChance: Availability;
  priestMediationRadius: Availability;
  priestMediationBias: Availability;
}

export interface OverlayControlTruth {
  focusSelected: Availability;
  hearing: Availability;
  talking: Availability;
  contactNetwork: Availability;
  fogPreview: Availability;
  fogPreviewDetail: Availability;
}

export interface FlatlanderControlTruth {
  includeBoundaries: Availability;
}

const RESET_ONLY_HINT = 'Applies when the world is regenerated on Reset.';
const SELECTION_OVERLAY_REASON = 'Select an entity to use this overlay.';

export function describeEnvironmentControlTruth(settings: {
  housesEnabled: boolean;
  rainEnabled: boolean;
  townPopulation: number;
}): EnvironmentControlTruth {
  const houseGeneration = settings.housesEnabled
    ? {
        enabled: true,
        enabledHint: RESET_ONLY_HINT,
      }
    : {
        enabled: false,
        disabledReason: 'Enable houses first.',
      };
  const squareHouses =
    !settings.housesEnabled
      ? {
          enabled: false,
          disabledReason: 'Enable houses first.',
        }
      : settings.townPopulation >= 10_000
        ? {
            enabled: false,
            disabledReason: 'Square houses are suppressed in towns at or above population 10,000.',
          }
        : {
            enabled: true,
            enabledHint: RESET_ONLY_HINT,
          };
  const activeHouseOverlayHint = 'Applies to the current rendered town immediately.';

  return {
    houseGeneration,
    squareHouses,
    rainEnabled: settings.housesEnabled
      ? {
          enabled: true,
          enabledHint: 'Takes effect immediately for weather scheduling.',
        }
      : {
          enabled: false,
          disabledReason: 'Enable houses first.',
        },
    rainOverlay:
      settings.housesEnabled && settings.rainEnabled
        ? {
            enabled: true,
            enabledHint: 'Shows the current rain state immediately.',
          }
        : {
            enabled: false,
            disabledReason: settings.housesEnabled
              ? 'Enable rain first.'
              : 'Enable houses and rain first.',
          },
    houseDoors: settings.housesEnabled
      ? {
          enabled: true,
          enabledHint: activeHouseOverlayHint,
        }
      : {
          enabled: false,
          disabledReason: 'Enable houses first.',
        },
    houseOccupancy: settings.housesEnabled
      ? {
          enabled: true,
          enabledHint: activeHouseOverlayHint,
        }
      : {
        enabled: false,
        disabledReason: 'Enable houses first.',
        },
  };
}

export function describePeaceCryControlTruth(settings: {
  enabled: boolean;
  strictComplianceEnabled: boolean;
  northYieldEnabled: boolean;
  rainCurfewEnabled: boolean;
}): PeaceCryControlTruth {
  const masterHint = 'Updates peace-cry defaults immediately for the active model.';
  return {
    cadence: settings.enabled
      ? { enabled: true, enabledHint: masterHint }
      : { enabled: false, disabledReason: 'Enable peace-cry defaults first.' },
    radius: settings.enabled
      ? { enabled: true, enabledHint: masterHint }
      : { enabled: false, disabledReason: 'Enable peace-cry defaults first.' },
    complianceStillness:
      settings.enabled && settings.strictComplianceEnabled
        ? { enabled: true, enabledHint: masterHint }
        : {
            enabled: false,
            disabledReason: settings.enabled
              ? 'Enable strict cry compliance first.'
              : 'Enable peace-cry defaults first.',
          },
    northYieldRadius:
      settings.enabled && settings.northYieldEnabled
        ? { enabled: true, enabledHint: masterHint }
        : {
            enabled: false,
            disabledReason: settings.enabled
              ? 'Enable north-yield etiquette first.'
              : 'Enable peace-cry defaults first.',
          },
    rainCurfewGrace:
      settings.enabled && settings.rainCurfewEnabled
        ? { enabled: true, enabledHint: masterHint }
        : {
            enabled: false,
            disabledReason: settings.enabled
              ? 'Enable rain curfew first.'
              : 'Enable peace-cry defaults first.',
          },
    applyAll: settings.enabled
      ? {
          enabled: true,
          enabledHint: 'Applies the current peace-cry defaults to existing segment entities immediately.',
        }
      : {
          enabled: false,
          disabledReason: 'Enable peace-cry defaults first.',
        },
  };
}

export function describeReproductionControlTruth(settings: {
  enabled: boolean;
  irregularBirthsEnabled: boolean;
  priestMediationEnabled: boolean;
}): ReproductionControlTruth {
  const masterHint = 'Updates the live reproduction policy immediately.';
  return {
    gestation: settings.enabled
      ? { enabled: true, enabledHint: masterHint }
      : { enabled: false, disabledReason: 'Enable reproduction first.' },
    matingRadius: settings.enabled
      ? { enabled: true, enabledHint: masterHint }
      : { enabled: false, disabledReason: 'Enable reproduction first.' },
    conceptionChance: settings.enabled
      ? { enabled: true, enabledHint: masterHint }
      : { enabled: false, disabledReason: 'Enable reproduction first.' },
    femaleBirthProbability: settings.enabled
      ? { enabled: true, enabledHint: masterHint }
      : { enabled: false, disabledReason: 'Enable reproduction first.' },
    maxPopulation: settings.enabled
      ? { enabled: true, enabledHint: masterHint }
      : { enabled: false, disabledReason: 'Enable reproduction first.' },
    irregularBaseChance:
      settings.enabled && settings.irregularBirthsEnabled
        ? { enabled: true, enabledHint: masterHint }
        : {
            enabled: false,
            disabledReason: settings.enabled
              ? 'Enable irregular births first.'
              : 'Enable reproduction first.',
          },
    priestMediationRadius:
      settings.enabled && settings.priestMediationEnabled
        ? { enabled: true, enabledHint: masterHint }
        : {
            enabled: false,
            disabledReason: settings.enabled
              ? 'Enable priest mediation first.'
              : 'Enable reproduction first.',
          },
    priestMediationBias:
      settings.enabled && settings.priestMediationEnabled
        ? { enabled: true, enabledHint: masterHint }
        : {
            enabled: false,
            disabledReason: settings.enabled
              ? 'Enable priest mediation first.'
              : 'Enable reproduction first.',
          },
  };
}

export function describeOverlayControlTruth(settings: {
  enabled: boolean;
  showHearingOverlay: boolean;
  showContactNetwork: boolean;
  fogPreviewEnabled: boolean;
}, hasSelection: boolean): OverlayControlTruth {
  const overlaysReason = 'Enable Event Highlights first.';
  const hearingHint = 'Shows the selected entity’s current hearing line.';
  return {
    focusSelected:
      settings.enabled && hasSelection
        ? {
            enabled: true,
            enabledHint: 'Filters overlays and the timeline to the selected entity.',
          }
        : {
            enabled: false,
            disabledReason: settings.enabled ? SELECTION_OVERLAY_REASON : overlaysReason,
          },
    hearing:
      settings.enabled && hasSelection
        ? { enabled: true, enabledHint: hearingHint }
        : {
            enabled: false,
            disabledReason: settings.enabled ? SELECTION_OVERLAY_REASON : overlaysReason,
          },
    talking:
      settings.enabled && hasSelection && settings.showHearingOverlay
        ? {
            enabled: true,
            enabledHint: 'Shows who the selected entity is currently hearing.',
          }
        : {
            enabled: false,
            disabledReason: !settings.enabled
              ? overlaysReason
              : !hasSelection
                ? SELECTION_OVERLAY_REASON
                : 'Enable Hearing Overlay first.',
          },
    contactNetwork:
      settings.enabled && hasSelection
        ? {
            enabled: true,
            enabledHint: 'Shows parent and known-contact links for the selected entity.',
          }
        : {
            enabled: false,
            disabledReason: settings.enabled ? SELECTION_OVERLAY_REASON : overlaysReason,
          },
    fogPreview:
      settings.enabled && hasSelection
        ? {
            enabled: true,
            enabledHint: 'Previews fog from the selected observer’s eye.',
          }
        : {
            enabled: false,
            disabledReason: settings.enabled ? SELECTION_OVERLAY_REASON : overlaysReason,
          },
    fogPreviewDetail:
      settings.enabled && hasSelection && settings.fogPreviewEnabled
        ? {
            enabled: true,
            enabledHint: 'Refines the selected observer’s fog preview.',
          }
        : {
            enabled: false,
            disabledReason: !settings.enabled
              ? overlaysReason
              : !hasSelection
                ? SELECTION_OVERLAY_REASON
                : 'Enable Fog Preview first.',
          },
  };
}

export function describeFlatlanderControlTruth(
  settings: { enabled: boolean },
  topology: WorldTopology,
): FlatlanderControlTruth {
  if (!settings.enabled) {
    return {
      includeBoundaries: {
        enabled: false,
        disabledReason: 'Enable Flatlander View first.',
      },
    };
  }

  if (topology === 'torus') {
    return {
      includeBoundaries: {
        enabled: false,
        disabledReason: 'World boundaries only exist in bounded topology.',
      },
    };
  }

  return {
    includeBoundaries: {
      enabled: true,
      enabledHint: 'Shows bounded-world edges in the 1D view.',
    },
  };
}
