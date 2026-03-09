import type { BoundaryMode } from '../core/components';
import { spawnFromRequest, type SpawnRequest } from '../core/factory';
import { boundaryFromTopology } from '../core/topology';
import { createWorld, type World, type WorldConfig } from '../core/world';
import { spawnHouses } from '../core/worldgen/houses';
import { createReleaseSpawnPlan, createReleaseWorldConfig } from './releasePreset';

export function defaultSpawnPlan(boundary: BoundaryMode = 'wrap'): SpawnRequest[] {
  return createReleaseSpawnPlan(boundary);
}

export function defaultWorldConfig(topology: 'torus' | 'bounded' = 'torus'): Partial<WorldConfig> {
  return createReleaseWorldConfig(topology);
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
