import { regularPolygonVertices, regularityMetric } from '../../geometry/polygon';
import { distance } from '../../geometry/vector';
import type { Vec2 } from '../../geometry/vector';
import type { HouseKind } from '../components';
import type { SeededRng } from '../rng';
import type { ShapeComponent } from '../shapes';
import type { World, WorldConfig } from '../world';

const SQUARE_RESTRICTION_POPULATION = 10_000;
const HOUSE_MIN_RADIUS = 10;
const HOUSE_SPACING = 8;
const MAX_ATTEMPTS_PER_HOUSE = 40;

export type HouseConfig = Pick<
  WorldConfig,
  | 'housesEnabled'
  | 'houseCount'
  | 'townPopulation'
  | 'allowTriangularForts'
  | 'allowSquareHouses'
  | 'houseSize'
>;

interface PlacementRecord {
  position: Vec2;
  radius: number;
}

function allowsSquareHouses(config: HouseConfig): boolean {
  return config.allowSquareHouses && config.townPopulation < SQUARE_RESTRICTION_POPULATION;
}

function chooseHouseKind(rng: SeededRng, config: HouseConfig): HouseKind {
  if (config.allowTriangularForts && rng.next() < 0.08) {
    return 'TriangleFort';
  }

  if (allowsSquareHouses(config) && rng.next() < 0.2) {
    return 'Square';
  }

  return 'Pentagon';
}

function sidesFromHouseKind(houseKind: HouseKind): number {
  switch (houseKind) {
    case 'TriangleFort':
      return 3;
    case 'Square':
      return 4;
    case 'Pentagon':
    default:
      return 5;
  }
}

function isPositionValid(position: Vec2, radius: number, placed: PlacementRecord[]): boolean {
  for (const existing of placed) {
    const required = radius + existing.radius + HOUSE_SPACING;
    if (distance(position, existing.position) < required) {
      return false;
    }
  }

  return true;
}

function houseShape(houseKind: HouseKind, baseSize: number): ShapeComponent {
  const sides = sidesFromHouseKind(houseKind);
  const radius = Math.max(HOUSE_MIN_RADIUS, baseSize);
  const vertices = regularPolygonVertices(sides, radius);

  return {
    kind: 'polygon',
    sides,
    vertices,
    regular: true,
    irregularity: regularityMetric(vertices),
    boundingRadius: radius,
  };
}

export function spawnHouses(world: World, rng: SeededRng, config: HouseConfig): number[] {
  if (!config.housesEnabled || config.houseCount <= 0) {
    return [];
  }

  const created: number[] = [];
  const placed: PlacementRecord[] = [];

  const baseSize = Math.max(HOUSE_MIN_RADIUS, config.houseSize);
  const margin = baseSize + HOUSE_SPACING;
  const maxAttempts = config.houseCount * MAX_ATTEMPTS_PER_HOUSE;

  for (let attempts = 0; attempts < maxAttempts && created.length < config.houseCount; attempts += 1) {
    const houseKind = chooseHouseKind(rng, config);
    const shape = houseShape(houseKind, baseSize);
    const radius = shape.boundingRadius;
    const position = {
      x: rng.nextRange(margin, Math.max(margin, world.config.width - margin)),
      y: rng.nextRange(margin, Math.max(margin, world.config.height - margin)),
    };

    if (!isPositionValid(position, radius, placed)) {
      continue;
    }

    const id = world.nextEntityId;
    world.nextEntityId += 1;

    world.entities.add(id);
    world.transforms.set(id, {
      position,
      rotation: 0,
    });
    world.shapes.set(id, shape);
    world.southDrifts.set(id, { vy: 0 });
    world.staticObstacles.set(id, { kind: 'house' });
    world.houses.set(id, {
      houseKind,
      doorEastWorld: {
        x: position.x + radius,
        y: position.y,
      },
      doorWestWorld: {
        x: position.x - radius,
        y: position.y,
      },
    });

    created.push(id);
    placed.push({
      position,
      radius,
    });
  }

  return created;
}
