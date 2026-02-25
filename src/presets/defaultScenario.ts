import type { BoundaryMode } from '../core/components';
import { spawnFromRequest, type SpawnRequest } from '../core/factory';
import { boundaryFromTopology } from '../core/topology';
import { createWorld, type World, type WorldConfig } from '../core/world';
import { spawnHouses } from '../core/worldgen/houses';

export function defaultSpawnPlan(boundary: BoundaryMode = 'wrap'): SpawnRequest[] {
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
      count: 1,
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
      count: 1,
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

export function defaultWorldConfig(topology: 'torus' | 'bounded' = 'torus'): Partial<WorldConfig> {
  return {
    topology,
    housesEnabled: true,
    houseCount: 8,
    townPopulation: 5000,
    allowTriangularForts: false,
    allowSquareHouses: false,
    houseSize: 30,
    houseMinSpacing: 11,
    rainEnabled: true,
    rainPeriodTicks: 2000,
    rainDurationTicks: 700,
    peaceCryEnabled: true,
    defaultPeaceCryCadenceTicks: 20,
    defaultPeaceCryRadius: 120,
    reproductionEnabled: true,
    gestationTicks: 130,
    matingRadius: 52,
    conceptionChancePerTick: 0.02,
    femaleBirthProbability: 0.52,
    maxPopulation: 650,
    irregularBirthsEnabled: true,
    irregularBirthBaseChance: 0.14,
    irregularBirthChance: 0.14,
    southAttractionEnabled: true,
    southAttractionStrength: 2,
    southAttractionWomenMultiplier: 2,
    southAttractionZoneStartFrac: 0.75,
    southAttractionZoneEndFrac: 0.95,
    southAttractionDrag: 12,
    southAttractionMaxTerminal: 1.8,
    southEscapeFraction: 0.5,
    sightEnabled: true,
    fogDensity: 0.012,
  };
}

export function applySpawnPlan(world: World, plan: SpawnRequest[]): void {
  for (const request of plan) {
    spawnFromRequest(world, request);
  }
}

export function applyDefaultSpawnPlan(world: World): void {
  const boundary = boundaryFromTopology(world.config.topology);
  applySpawnPlan(world, defaultSpawnPlan(boundary));
}

export function populateDefaultWorld(world: World): void {
  spawnHouses(world, world.rng, world.config);
  applyDefaultSpawnPlan(world);
}

export function createDefaultWorld(seed: number): World {
  const world = createWorld(seed, defaultWorldConfig('torus'));
  populateDefaultWorld(world);
  return world;
}
