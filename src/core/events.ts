import type { Vec2 } from '../geometry/vector';

export type WorldEvent =
  | { type: 'touch'; tick: number; aId: number; bId: number; pos: Vec2 }
  | { type: 'handshake'; tick: number; aId: number; bId: number; pos: Vec2 }
  | { type: 'peaceCry'; tick: number; emitterId: number; pos: Vec2; radius: number }
  | { type: 'stab'; tick: number; attackerId: number; victimId: number; pos: Vec2; sharpness: number }
  | { type: 'death'; tick: number; entityId: number; pos: Vec2 }
  | { type: 'birth'; tick: number; childId: number; motherId: number; pos: Vec2 }
  | { type: 'regularized'; tick: number; entityId: number; pos: Vec2 };

export class EventQueue {
  private events: WorldEvent[] = [];

  push(event: WorldEvent): void {
    this.events.push(event);
  }

  drain(): WorldEvent[] {
    const drained = this.events;
    this.events = [];
    return drained;
  }

  clear(): void {
    this.events.length = 0;
  }
}

export interface EntityPair {
  a: number;
  b: number;
}

export function orderedEntityPairs(pairs: EntityPair[]): EntityPair[] {
  const normalized = pairs.map((pair) => ({
    a: Math.min(pair.a, pair.b),
    b: Math.max(pair.a, pair.b),
  }));

  normalized.sort((left, right) => {
    if (left.a !== right.a) {
      return left.a - right.a;
    }
    return left.b - right.b;
  });

  const unique: EntityPair[] = [];
  for (const pair of normalized) {
    const previous = unique[unique.length - 1];
    if (previous && previous.a === pair.a && previous.b === pair.b) {
      continue;
    }
    unique.push(pair);
  }

  return unique;
}
