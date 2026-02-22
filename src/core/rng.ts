export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return result;
  }

  nextRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    return Math.floor(this.nextRange(minInclusive, maxInclusive + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick from an empty list.');
    }
    const index = this.nextInt(0, items.length - 1);
    return items[index] as T;
  }
}
