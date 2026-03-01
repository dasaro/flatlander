import { Rank } from './rank';
import type { NameComponent } from './components';
import type { ShapeComponent } from './shapes';

const INITIALS = [
  'Al',
  'Bel',
  'Cor',
  'Dar',
  'El',
  'Fen',
  'Gal',
  'Har',
  'Ith',
  'Jul',
  'Kel',
  'Lor',
  'Mer',
  'Nor',
  'Or',
  'Per',
  'Quen',
  'Ros',
  'Sel',
  'Tor',
  'Ul',
  'Val',
  'Wyn',
  'Yor',
];

const MID_SYLLABLES = [
  'a',
  'e',
  'i',
  'o',
  'u',
  'ae',
  'ia',
  'io',
  'ea',
  'ou',
  'ar',
  'er',
  'ir',
  'or',
  'ur',
  'an',
  'en',
  'in',
  'on',
  'un',
];

const ENDINGS = [
  'ton',
  'ford',
  'well',
  'mere',
  'croft',
  'ridge',
  'worth',
  'ley',
  'hurst',
  'cote',
  'shaw',
  'mont',
  'field',
  'stone',
  'wall',
  'borne',
  'gate',
  'row',
  'dale',
  'wick',
  'stead',
  'combe',
];

const FAMILY_SUFFIXES = [
  'son',
  'sby',
  'ham',
  'bury',
  'hurst',
  'wood',
  'bank',
  'bridge',
  'march',
  'thorne',
  'stead',
  'court',
  'crest',
  'moor',
  'cliff',
  'vale',
  'barrow',
  'ward',
  'hall',
  'brook',
];

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

function buildSyllabicWord(seed: number, minParts: number, maxParts: number): string {
  const parts = minParts + (hash32(seed ^ 0x6a09e667) % Math.max(1, maxParts - minParts + 1));
  const initial = pick(INITIALS, seed ^ 0xbb67ae85);
  let word = initial;

  for (let i = 0; i < parts - 1; i += 1) {
    const mid = pick(MID_SYLLABLES, seed ^ Math.imul(i + 1, 0x3c6ef372));
    word += mid;
  }

  word += pick(ENDINGS, seed ^ 0xa54ff53a);
  return word;
}

function buildFamilyWord(seed: number): string {
  const root = buildSyllabicWord(seed ^ 0x510e527f, 1, 2);
  const suffix = pick(FAMILY_SUFFIXES, seed ^ 0x9b05688c);
  return `${root}${suffix}`;
}

function encodeEntityToken(entityId: number): string {
  let n = Math.max(1, Math.floor(entityId));
  let out = '';
  while (n > 0) {
    out = TOKEN_ALPHABET[n % TOKEN_ALPHABET.length] + out;
    n = Math.floor(n / TOKEN_ALPHABET.length);
  }
  return out.padStart(3, 'A');
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
  const given = buildSyllabicWord(base ^ 0x243f6a88, 2, 3);
  const family = buildFamilyWord(base ^ 0x85a308d3);
  const title = titleFor(rank, shape);
  const suffix = encodeEntityToken(entityId);
  return {
    given,
    family,
    title,
    suffix,
    displayName: `${title} ${given} ${family}-${suffix}`,
  };
}

export function retitleName(name: NameComponent, rank: Rank, shape: ShapeComponent): NameComponent {
  const title = titleFor(rank, shape);
  return {
    ...name,
    title,
    displayName: `${title} ${name.given} ${name.family}-${name.suffix}`,
  };
}
