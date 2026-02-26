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

const ROMAN_DIGITS: Array<{ value: number; symbol: string }> = [
  { value: 1000, symbol: 'M' },
  { value: 900, symbol: 'CM' },
  { value: 500, symbol: 'D' },
  { value: 400, symbol: 'CD' },
  { value: 100, symbol: 'C' },
  { value: 90, symbol: 'XC' },
  { value: 50, symbol: 'L' },
  { value: 40, symbol: 'XL' },
  { value: 10, symbol: 'X' },
  { value: 9, symbol: 'IX' },
  { value: 5, symbol: 'V' },
  { value: 4, symbol: 'IV' },
  { value: 1, symbol: 'I' },
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

function toRoman(value: number): string {
  let n = Math.max(1, Math.floor(value));
  let out = '';
  for (const digit of ROMAN_DIGITS) {
    while (n >= digit.value) {
      out += digit.symbol;
      n -= digit.value;
    }
  }
  return out;
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
  const suffix = toRoman(entityId);
  return {
    given,
    family,
    title,
    suffix,
    displayName: `${title} ${given} ${family} ${suffix}`,
  };
}

export function retitleName(name: NameComponent, rank: Rank, shape: ShapeComponent): NameComponent {
  const title = titleFor(rank, shape);
  return {
    ...name,
    title,
    displayName: `${title} ${name.given} ${name.family} ${name.suffix}`,
  };
}
