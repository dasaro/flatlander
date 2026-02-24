import { distance } from '../../geometry/vector';
import type { Vec2 } from '../../geometry/vector';
import type { HouseKind } from '../components';
import { createHouseLayout, houseComponentFromLayout, houseShapeFromLayout } from '../housing/houseFactory';
import type { SeededRng } from '../rng';
import type { World, WorldConfig } from '../world';

const SQUARE_RESTRICTION_POPULATION = 10_000;
const MAX_ATTEMPTS_PER_HOUSE = 60;
const TRIANGULAR_FORT_CHANCE = 0.03;
const SQUARE_CHANCE = 0.08;

export type HouseConfig = Pick<
  WorldConfig,
  | 'housesEnabled'
  | 'houseCount'
  | 'townPopulation'
  | 'allowTriangularForts'
  | 'allowSquareHouses'
  | 'houseSize'
  | 'houseMinSpacing'
>;

interface PlacementRecord {
  position: Vec2;
  radius: number;
}

function canUseSquareHouses(config: HouseConfig): boolean {
  return config.allowSquareHouses && config.townPopulation < SQUARE_RESTRICTION_POPULATION;
}

function chooseHouseKind(rng: SeededRng, config: HouseConfig): HouseKind {
  // Part I §2: pentagons are typical; triangles/squares are exceptional.
  if (config.allowTriangularForts && rng.next() < TRIANGULAR_FORT_CHANCE) {
    return 'TriangleFort';
  }
  if (canUseSquareHouses(config) && rng.next() < SQUARE_CHANCE) {
    return 'Square';
  }
  return 'Pentagon';
}

function isPositionValid(position: Vec2, radius: number, spacing: number, placed: PlacementRecord[]): boolean {
  for (const existing of placed) {
    const required = radius + existing.radius + spacing;
    if (distance(position, existing.position) < required) {
      return false;
    }
  }
  return true;
}

export function spawnHouses(world: World, rng: SeededRng, config: HouseConfig): number[] {
  if (!config.housesEnabled || config.houseCount <= 0) {
    return [];
  }

  const created: number[] = [];
  const placed: PlacementRecord[] = [];
  const baseSize = Math.max(10, config.houseSize);
  const spacing = Math.max(0, config.houseMinSpacing);
  const margin = baseSize + spacing;
  const maxAttempts = Math.max(1, config.houseCount) * MAX_ATTEMPTS_PER_HOUSE;

  for (let attempt = 0; attempt < maxAttempts && created.length < config.houseCount; attempt += 1) {
    const houseKind = chooseHouseKind(rng, config);
    const layout = createHouseLayout(houseKind, baseSize);
    const shape = houseShapeFromLayout(layout);
    const radius = shape.boundingRadius;
    const position = {
      x: rng.nextRange(margin, Math.max(margin, world.config.width - margin)),
      y: rng.nextRange(margin, Math.max(margin, world.config.height - margin)),
    };

    if (!isPositionValid(position, radius, spacing, placed)) {
      continue;
    }

    const id = world.nextEntityId;
    world.nextEntityId += 1;

    world.entities.add(id);
    world.transforms.set(id, {
      position,
      rotation: 0, // Part I §2: N-S bearings are meaningful; houses stay axis-aligned.
    });
    world.shapes.set(id, shape);
    world.southDrifts.set(id, { vy: 0 });
    world.staticObstacles.set(id, { kind: 'house' });
    world.houses.set(id, houseComponentFromLayout(houseKind, layout, null));
    world.houseOccupants.set(id, new Set());

    created.push(id);
    placed.push({ position, radius });
  }

  return created;
}
