import type { Aabb } from './intersections';

interface SpatialItem {
  id: number;
  aabb: Aabb;
}

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function pairKey(a: number, b: number): string {
  return `${a}:${b}`;
}

function parsePairKey(key: string): [number, number] {
  const separator = key.indexOf(':');
  const left = Number(key.slice(0, separator));
  const right = Number(key.slice(separator + 1));
  return [left, right];
}

export class SpatialHashGrid {
  constructor(private readonly cellSize: number) {}

  computePairs(items: SpatialItem[]): Array<[number, number]> {
    const cells = new Map<string, number[]>();

    for (const item of items) {
      const minX = Math.floor(item.aabb.minX / this.cellSize);
      const maxX = Math.floor(item.aabb.maxX / this.cellSize);
      const minY = Math.floor(item.aabb.minY / this.cellSize);
      const maxY = Math.floor(item.aabb.maxY / this.cellSize);

      for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
          const key = cellKey(x, y);
          const bucket = cells.get(key);
          if (bucket) {
            bucket.push(item.id);
          } else {
            cells.set(key, [item.id]);
          }
        }
      }
    }

    const pairKeys = new Set<string>();
    for (const bucket of cells.values()) {
      bucket.sort((a, b) => a - b);
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          const a = bucket[i];
          const b = bucket[j];
          if (a === undefined || b === undefined) {
            continue;
          }
          pairKeys.add(pairKey(a, b));
        }
      }
    }

    const pairs: Array<[number, number]> = [];
    const sortedKeys = [...pairKeys].sort((a, b) => {
      const [a0, a1] = parsePairKey(a);
      const [b0, b1] = parsePairKey(b);
      if (a0 !== b0) {
        return a0 - b0;
      }
      return a1 - b1;
    });

    for (const key of sortedKeys) {
      const [a, b] = parsePairKey(key);
      pairs.push([a, b]);
    }

    return pairs;
  }
}
