import { Rank } from './rank';
import type { ShapeComponent } from './shapes';
import type { NameComponent } from './components';

const GIVEN_NAMES = [
  'Aldous',
  'Beatrice',
  'Cedric',
  'Dorothea',
  'Edmund',
  'Florence',
  'Gideon',
  'Harriet',
  'Isobel',
  'Julian',
  'Leopold',
  'Mabel',
];

const FAMILY_NAMES = [
  'Smith',
  'Jones',
  'Hawthorne',
  'Pembroke',
  'Ashford',
  'Kensley',
  'Redford',
  'Langley',
  'Whitcombe',
  'Marston',
  'Ainsworth',
  'Blackwell',
];

function hash32(seed: number): number {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function pick<T>(arr: readonly T[], seed: number): T {
  const idx = arr.length <= 1 ? 0 : hash32(seed) % arr.length;
  const value = arr[idx];
  if (value === undefined) {
    throw new Error('Name pool unexpectedly empty.');
  }
  return value;
}

function titleFor(rank: Rank, shape: ShapeComponent): string {
  if (shape.kind === 'segment') {
    return 'Lady';
  }
  if (rank === Rank.Priest) {
    return 'His Circularity';
  }
  if (rank === Rank.NearCircle || rank === Rank.Noble) {
    return 'Sir';
  }
  return 'Mr.';
}

export function buildDeterministicName(
  worldSeed: number,
  entityId: number,
  rank: Rank,
  shape: ShapeComponent,
): NameComponent {
  const base = hash32(worldSeed ^ Math.imul(entityId, 0x9e3779b1));
  const given = pick(GIVEN_NAMES, base ^ 0xa511e9b3);
  const family = pick(FAMILY_NAMES, base ^ 0x74a7c15d);
  const title = titleFor(rank, shape);
  return {
    given,
    family,
    title,
    displayName: `${title} ${family}`,
  };
}

export function retitleName(name: NameComponent, rank: Rank, shape: ShapeComponent): NameComponent {
  const title = titleFor(rank, shape);
  return {
    ...name,
    title,
    displayName: `${title} ${name.family}`,
  };
}
