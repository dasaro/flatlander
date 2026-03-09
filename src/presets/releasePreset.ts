import type { BoundaryMode } from '../core/components';
import type { SpawnRequest } from '../core/factory';
import type { WorldConfig } from '../core/world';
import type {
  EnvironmentSettings,
  EventHighlightsSettings,
  FlatlanderViewSettings,
  FogSightSettings,
  PeaceCrySettings,
  ReproductionSettings,
  SouthAttractionSettings,
} from '../ui/uiController';

export const RELEASE_PRESET_ID = 'v1-canonical-2026-03-08';

const HOUSES_ENABLED = true;
const HOUSE_COUNT = 8;
const TOWN_POPULATION = 5000;
const ALLOW_TRIANGULAR_FORTS = false;
const ALLOW_SQUARE_HOUSES = false;
const HOUSE_SIZE = 30;
const RAIN_ENABLED = true;
const COLOR_ENABLED = false;
const RAIN_BASE_PERIOD_TICKS = 2000;
const RAIN_PERIOD_JITTER_FRAC = 0.24;
const RAIN_BASE_DURATION_TICKS = 700;
const RAIN_DURATION_JITTER_FRAC = 0.18;
const PEACE_CRY_CADENCE_TICKS = 20;
const PEACE_CRY_RADIUS = 120;
const PEACE_CRY_STRICT_COMPLIANCE = true;
const PEACE_CRY_COMPLIANCE_STILLNESS_TICKS = 3;
const NORTH_YIELD_ENABLED = true;
const NORTH_YIELD_RADIUS = 170;
const RAIN_CURFEW_ENABLED = true;
const RAIN_CURFEW_OUTSIDE_GRACE_TICKS = 150;
const REPRODUCTION_ENABLED = true;
const GESTATION_TICKS = 170;
const MATING_RADIUS = 52;
const CONCEPTION_CHANCE_PER_TICK = 0.012;
const FEMALE_BIRTH_PROBABILITY = 0.52;
const MAX_POPULATION = 320;
const MALE_BIRTH_HIGH_RANK_PENALTY_PER_SIDE = 0.065;
const CONCEPTION_HIGH_RANK_PENALTY_PER_SIDE = 0.11;
const HIGH_ORDER_THRESHOLD_SIDES = 10;
const HIGH_ORDER_MALE_BIRTH_PENALTY_MULTIPLIER = 1.6;
const HIGH_ORDER_CONCEPTION_PENALTY_MULTIPLIER = 1.8;
const HIGH_ORDER_DEVELOPMENT_JUMP_MAX = 6;
const RARITY_MARRIAGE_BIAS_STRENGTH = 0.75;
const IRREGULAR_BIRTHS_ENABLED = true;
const IRREGULAR_BIRTH_BASE_CHANCE = 0.14;
const PRIEST_MEDIATION_ENABLED = true;
const PRIEST_MEDIATION_RADIUS = 180;
const PRIEST_MEDIATION_BIAS = 0.6;
const NEO_THERAPY_ENABLED = true;
const NEO_THERAPY_AMBITION_PROBABILITY = 0.6;
const NEO_THERAPY_SURVIVAL_PROBABILITY = 0.28;
const NEO_THERAPY_ENROLLMENT_THRESHOLD_SIDES = 8;
const SOUTH_ATTRACTION_ENABLED = true;
const SOUTH_ATTRACTION_STRENGTH = 2;
const SOUTH_ATTRACTION_WOMEN_MULTIPLIER = 2;
const SOUTH_ATTRACTION_ZONE_START = 0.75;
const SOUTH_ATTRACTION_ZONE_END = 0.95;
const SOUTH_ATTRACTION_DRAG = 12;
const SOUTH_ATTRACTION_MAX_TERMINAL = 1.8;
const SOUTH_ESCAPE_FRACTION = 0.5;
const SIGHT_ENABLED = true;
const FOG_DENSITY = 0.012;
const FOG_FIELD_CELL_SIZE = 84;
const FOG_FIELD_VARIATION = 0.45;
const FOG_TORRID_ZONE_START = 0.72;
const FOG_TORRID_ZONE_RELIEF = 0.42;
const POSTPARTUM_COOLDOWN_TICKS = 130;
const CROWD_STRESS_THRESHOLD = 3;
const CROWD_STRESS_WEAR_SCALE = 1.2;
const CROWD_STRESS_EXECUTION_CHANCE = 0.011;
const CROWD_COMFORT_POPULATION = 170;
const CROWD_OVERLOAD_WEAR_SCALE = 3.4;

export function createReleaseSpawnPlan(boundary: BoundaryMode = 'wrap'): SpawnRequest[] {
  return [
    {
      shape: {
        kind: 'segment',
        size: 22,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 14,
        maxTurnRate: 1.45,
        decisionEveryTicks: 20,
        intentionMinTicks: 95,
        boundary,
      },
      count: 11,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 3,
        size: 16,
        irregular: false,
        triangleKind: 'Equilateral',
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 14,
        maxTurnRate: 1.15,
        decisionEveryTicks: 18,
        intentionMinTicks: 88,
        boundary,
      },
      count: 7,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 3,
        size: 17,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.08,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 16,
        maxTurnRate: 1.3,
        decisionEveryTicks: 14,
        intentionMinTicks: 72,
        boundary,
      },
      count: 5,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 4,
        size: 18,
        irregular: false,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 13,
        maxTurnRate: 1,
        decisionEveryTicks: 20,
        intentionMinTicks: 96,
        boundary,
      },
      count: 4,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 4,
        size: 18,
        irregular: true,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 13,
        maxTurnRate: 1.1,
        decisionEveryTicks: 18,
        intentionMinTicks: 82,
        boundary,
      },
      count: 2,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 5,
        size: 19,
        irregular: false,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 13,
        maxTurnRate: 1,
        decisionEveryTicks: 20,
        intentionMinTicks: 96,
        boundary,
      },
      count: 1,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 5,
        size: 19,
        irregular: true,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 14,
        maxTurnRate: 1.15,
        decisionEveryTicks: 17,
        intentionMinTicks: 80,
        boundary,
      },
      count: 2,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 6,
        size: 19,
        irregular: false,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 11,
        maxTurnRate: 0.82,
        decisionEveryTicks: 22,
        intentionMinTicks: 105,
        boundary,
      },
      count: 1,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 7,
        size: 20,
        irregular: true,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 15,
        maxTurnRate: 1.2,
        decisionEveryTicks: 16,
        intentionMinTicks: 75,
        boundary,
      },
      count: 2,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 15,
        size: 20,
        irregular: false,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 8,
        maxTurnRate: 0.7,
        decisionEveryTicks: 24,
        intentionMinTicks: 122,
        boundary,
      },
      count: 1,
    },
    {
      shape: {
        kind: 'circle',
        size: 14,
      },
      movement: {
        type: 'socialNav',
        maxSpeed: 7,
        maxTurnRate: 0.62,
        decisionEveryTicks: 25,
        intentionMinTicks: 128,
        boundary,
      },
      count: 1,
    },
  ];
}

export function createReleaseWorldConfig(
  topology: 'torus' | 'bounded' = 'torus',
): Partial<WorldConfig> {
  return {
    topology,
    housesEnabled: HOUSES_ENABLED,
    houseCount: HOUSE_COUNT,
    townPopulation: TOWN_POPULATION,
    allowTriangularForts: ALLOW_TRIANGULAR_FORTS,
    allowSquareHouses: ALLOW_SQUARE_HOUSES,
    houseSize: HOUSE_SIZE,
    houseMinSpacing: 11,
    rainEnabled: RAIN_ENABLED,
    colorEnabled: COLOR_ENABLED,
    rainPeriodTicks: RAIN_BASE_PERIOD_TICKS,
    rainDurationTicks: RAIN_BASE_DURATION_TICKS,
    rainBasePeriodTicks: RAIN_BASE_PERIOD_TICKS,
    rainPeriodJitterFrac: RAIN_PERIOD_JITTER_FRAC,
    rainBaseDurationTicks: RAIN_BASE_DURATION_TICKS,
    rainDurationJitterFrac: RAIN_DURATION_JITTER_FRAC,
    peaceCryEnabled: true,
    defaultPeaceCryCadenceTicks: PEACE_CRY_CADENCE_TICKS,
    defaultPeaceCryRadius: PEACE_CRY_RADIUS,
    reproductionEnabled: REPRODUCTION_ENABLED,
    gestationTicks: GESTATION_TICKS,
    matingRadius: MATING_RADIUS,
    conceptionChancePerTick: CONCEPTION_CHANCE_PER_TICK,
    femaleBirthProbability: FEMALE_BIRTH_PROBABILITY,
    maleBirthHighRankPenaltyPerSide: MALE_BIRTH_HIGH_RANK_PENALTY_PER_SIDE,
    conceptionHighRankPenaltyPerSide: CONCEPTION_HIGH_RANK_PENALTY_PER_SIDE,
    highOrderThresholdSides: HIGH_ORDER_THRESHOLD_SIDES,
    highOrderMaleBirthPenaltyMultiplier: HIGH_ORDER_MALE_BIRTH_PENALTY_MULTIPLIER,
    highOrderConceptionPenaltyMultiplier: HIGH_ORDER_CONCEPTION_PENALTY_MULTIPLIER,
    highOrderDevelopmentJumpMax: HIGH_ORDER_DEVELOPMENT_JUMP_MAX,
    rarityMarriageBiasStrength: RARITY_MARRIAGE_BIAS_STRENGTH,
    neoTherapyEnabled: NEO_THERAPY_ENABLED,
    neoTherapyEnrollmentThresholdSides: NEO_THERAPY_ENROLLMENT_THRESHOLD_SIDES,
    neoTherapyAmbitionProbability: NEO_THERAPY_AMBITION_PROBABILITY,
    neoTherapySurvivalProbability: NEO_THERAPY_SURVIVAL_PROBABILITY,
    postpartumCooldownTicks: POSTPARTUM_COOLDOWN_TICKS,
    maxPopulation: MAX_POPULATION,
    irregularBirthsEnabled: IRREGULAR_BIRTHS_ENABLED,
    irregularBirthBaseChance: IRREGULAR_BIRTH_BASE_CHANCE,
    irregularBirthChance: IRREGULAR_BIRTH_BASE_CHANCE,
    southAttractionEnabled: SOUTH_ATTRACTION_ENABLED,
    southAttractionStrength: SOUTH_ATTRACTION_STRENGTH,
    southAttractionWomenMultiplier: SOUTH_ATTRACTION_WOMEN_MULTIPLIER,
    southAttractionZoneStartFrac: SOUTH_ATTRACTION_ZONE_START,
    southAttractionZoneEndFrac: SOUTH_ATTRACTION_ZONE_END,
    southAttractionDrag: SOUTH_ATTRACTION_DRAG,
    southAttractionMaxTerminal: SOUTH_ATTRACTION_MAX_TERMINAL,
    southEscapeFraction: SOUTH_ESCAPE_FRACTION,
    sightEnabled: SIGHT_ENABLED,
    fogDensity: FOG_DENSITY,
    fogFieldCellSize: FOG_FIELD_CELL_SIZE,
    fogFieldVariation: FOG_FIELD_VARIATION,
    fogTorridZoneStartFrac: FOG_TORRID_ZONE_START,
    fogTorridZoneRelief: FOG_TORRID_ZONE_RELIEF,
    crowdStressThreshold: CROWD_STRESS_THRESHOLD,
    crowdStressWearScale: CROWD_STRESS_WEAR_SCALE,
    crowdStressExecutionChance: CROWD_STRESS_EXECUTION_CHANCE,
    crowdComfortPopulation: CROWD_COMFORT_POPULATION,
    crowdOverloadWearScale: CROWD_OVERLOAD_WEAR_SCALE,
  };
}

export function createReleaseUiDefaults(): {
  environment: EnvironmentSettings;
  peaceCry: PeaceCrySettings;
  reproduction: ReproductionSettings;
  eventHighlights: EventHighlightsSettings;
  flatlanderView: FlatlanderViewSettings;
  fogSight: FogSightSettings;
  southAttraction: SouthAttractionSettings;
} {
  return {
    environment: {
      housesEnabled: HOUSES_ENABLED,
      houseCount: HOUSE_COUNT,
      townPopulation: TOWN_POPULATION,
      allowTriangularForts: ALLOW_TRIANGULAR_FORTS,
      allowSquareHouses: ALLOW_SQUARE_HOUSES,
      houseSize: HOUSE_SIZE,
      rainEnabled: RAIN_ENABLED,
      colorEnabled: COLOR_ENABLED,
      showRainOverlay: true,
      showFogOverlay: true,
      showDoors: true,
      showOccupancy: true,
    },
    peaceCry: {
      enabled: true,
      cadenceTicks: PEACE_CRY_CADENCE_TICKS,
      radius: PEACE_CRY_RADIUS,
      strictComplianceEnabled: PEACE_CRY_STRICT_COMPLIANCE,
      complianceStillnessTicks: PEACE_CRY_COMPLIANCE_STILLNESS_TICKS,
      northYieldEnabled: NORTH_YIELD_ENABLED,
      northYieldRadius: NORTH_YIELD_RADIUS,
      rainCurfewEnabled: RAIN_CURFEW_ENABLED,
      rainCurfewOutsideGraceTicks: RAIN_CURFEW_OUTSIDE_GRACE_TICKS,
    },
    reproduction: {
      enabled: REPRODUCTION_ENABLED,
      gestationTicks: GESTATION_TICKS,
      matingRadius: MATING_RADIUS,
      conceptionChancePerTick: CONCEPTION_CHANCE_PER_TICK,
      femaleBirthProbability: FEMALE_BIRTH_PROBABILITY,
      maxPopulation: MAX_POPULATION,
      irregularBirthsEnabled: IRREGULAR_BIRTHS_ENABLED,
      irregularBirthBaseChance: IRREGULAR_BIRTH_BASE_CHANCE,
      priestMediationEnabled: PRIEST_MEDIATION_ENABLED,
      priestMediationRadius: PRIEST_MEDIATION_RADIUS,
      priestMediationBias: PRIEST_MEDIATION_BIAS,
    },
    eventHighlights: {
      enabled: true,
      intensity: 1,
      capPerTick: 120,
      showFeeling: true,
      focusOnSelected: false,
      showHearingOverlay: true,
      showTalkingOverlay: false,
      strokeByKills: false,
      showContactNetwork: true,
      networkShowParents: true,
      networkShowKnown: true,
      networkMaxKnownEdges: 25,
      networkShowOnlyOnScreen: true,
      networkFocusRadius: 400,
      dimByAge: true,
      dimByDeterioration: true,
      dimStrength: 0.55,
      fogPreviewEnabled: true,
      fogPreviewStrength: 0.5,
      fogPreviewHideBelowMin: false,
      fogPreviewRings: true,
      showEyes: true,
      showPovCone: false,
    },
    flatlanderView: {
      enabled: true,
      rays: 720,
      fovRad: Math.PI,
      lookOffsetRad: 0,
      maxDistance: 400,
      fogDensity: FOG_DENSITY,
      minVisibleIntensity: 0.06,
      grayscaleMode: true,
      includeObstacles: true,
      includeBoundaries: true,
      inanimateDimMultiplier: 0.65,
    },
    fogSight: {
      sightEnabled: SIGHT_ENABLED,
      fogDensity: FOG_DENSITY,
    },
    southAttraction: {
      enabled: SOUTH_ATTRACTION_ENABLED,
      strength: SOUTH_ATTRACTION_STRENGTH,
      womenMultiplier: SOUTH_ATTRACTION_WOMEN_MULTIPLIER,
      zoneStartFrac: SOUTH_ATTRACTION_ZONE_START,
      zoneEndFrac: SOUTH_ATTRACTION_ZONE_END,
      drag: SOUTH_ATTRACTION_DRAG,
      maxTerminal: SOUTH_ATTRACTION_MAX_TERMINAL,
      escapeFraction: SOUTH_ESCAPE_FRACTION,
      showSouthZoneOverlay: false,
    },
  };
}

export function createReleaseWorldConfigFromUiSettings(
  topology: 'torus' | 'bounded',
  southAttraction: SouthAttractionSettings,
  environment: EnvironmentSettings,
  peaceCry: PeaceCrySettings,
  reproduction: ReproductionSettings,
  fogSight: FogSightSettings,
): Partial<WorldConfig> {
  const base = createReleaseWorldConfig(topology);
  return {
    ...base,
    topology,
    housesEnabled: environment.housesEnabled,
    houseCount: Math.max(0, Math.round(environment.houseCount)),
    townPopulation: Math.max(0, Math.round(environment.townPopulation)),
    allowTriangularForts: environment.allowTriangularForts,
    allowSquareHouses: environment.allowSquareHouses,
    houseSize: Math.max(4, environment.houseSize),
    houseMinSpacing: Math.max(0, Math.round(environment.houseSize * 0.35)),
    rainEnabled: environment.rainEnabled && environment.housesEnabled,
    colorEnabled: environment.colorEnabled,
    peaceCryEnabled: peaceCry.enabled,
    strictPeaceCryComplianceEnabled: peaceCry.strictComplianceEnabled,
    peaceCryComplianceStillnessTicks: Math.max(
      1,
      Math.round(peaceCry.complianceStillnessTicks),
    ),
    northYieldEtiquetteEnabled: peaceCry.northYieldEnabled,
    northYieldRadius: Math.max(1, peaceCry.northYieldRadius),
    rainCurfewEnabled: peaceCry.rainCurfewEnabled,
    rainCurfewOutsideGraceTicks: Math.max(
      1,
      Math.round(peaceCry.rainCurfewOutsideGraceTicks),
    ),
    defaultPeaceCryCadenceTicks: Math.max(1, Math.round(peaceCry.cadenceTicks)),
    defaultPeaceCryRadius: Math.max(0, peaceCry.radius),
    reproductionEnabled: reproduction.enabled,
    gestationTicks: Math.max(1, Math.round(reproduction.gestationTicks)),
    matingRadius: Math.max(0, reproduction.matingRadius),
    conceptionChancePerTick: Math.max(0, Math.min(1, reproduction.conceptionChancePerTick)),
    femaleBirthProbability: Math.max(0, Math.min(1, reproduction.femaleBirthProbability)),
    maxPopulation: Math.max(1, Math.round(reproduction.maxPopulation)),
    irregularBirthsEnabled: reproduction.irregularBirthsEnabled,
    irregularBirthBaseChance: Math.max(0, Math.min(1, reproduction.irregularBirthBaseChance)),
    irregularBirthChance: Math.max(0, Math.min(1, reproduction.irregularBirthBaseChance)),
    priestMediationEnabled: reproduction.priestMediationEnabled,
    priestMediationRadius: Math.max(0, reproduction.priestMediationRadius),
    priestMediationBias: Math.max(0, reproduction.priestMediationBias),
    southAttractionEnabled: southAttraction.enabled,
    southAttractionStrength: southAttraction.strength,
    southAttractionWomenMultiplier: southAttraction.womenMultiplier,
    southAttractionZoneStartFrac: southAttraction.zoneStartFrac,
    southAttractionZoneEndFrac: southAttraction.zoneEndFrac,
    southAttractionDrag: southAttraction.drag,
    southAttractionMaxTerminal: southAttraction.maxTerminal,
    southEscapeFraction: southAttraction.escapeFraction,
    sightEnabled: fogSight.sightEnabled,
    fogDensity: fogSight.fogDensity,
  };
}
