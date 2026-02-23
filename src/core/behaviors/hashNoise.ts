const UINT_MAX = 0xffff_ffff;

function hashUint32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

export function hashNoise(seed: number, entityId: number, step: number): number {
  const mixed = hashUint32((seed >>> 0) ^ Math.imul(entityId >>> 0, 0x9e3779b1) ^ (step >>> 0));
  return mixed / UINT_MAX;
}
