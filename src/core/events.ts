import type { Vec2 } from '../geometry/vector';

export type WorldEvent =
  | {
      type: 'handshakeStart';
      tick: number;
      aId: number;
      bId: number;
      pos: Vec2;
      aRankKey?: string;
      bRankKey?: string;
    }
  | {
      type: 'handshakeAttemptFailed';
      tick: number;
      aId: number;
      bId: number;
      pos: Vec2;
      aRankKey?: string;
      bRankKey?: string;
    }
  | {
      type: 'touch';
      tick: number;
      aId: number;
      bId: number;
      pos: Vec2;
      aRankKey?: string;
      bRankKey?: string;
    }
  | {
      type: 'handshake';
      tick: number;
      aId: number;
      bId: number;
      pos: Vec2;
      aRankKey?: string;
      bRankKey?: string;
    }
  | {
      type: 'peaceCry';
      tick: number;
      emitterId: number;
      pos: Vec2;
      radius: number;
      emitterRankKey?: string;
    }
  | {
      type: 'stab';
      tick: number;
      attackerId: number;
      victimId: number;
      pos: Vec2;
      sharpness: number;
      attackerRankKey?: string;
      victimRankKey?: string;
    }
  | { type: 'death'; tick: number; entityId: number; pos: Vec2; rankKey?: string; killerId?: number }
  | {
      type: 'birth';
      tick: number;
      childId: number;
      motherId: number;
      pos: Vec2;
      childRankKey?: string;
      motherRankKey?: string;
    }
  | { type: 'regularized'; tick: number; entityId: number; pos: Vec2; rankKey?: string };

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

export function eventInvolvedIds(event: WorldEvent): number[] {
  switch (event.type) {
    case 'handshakeStart':
    case 'handshakeAttemptFailed':
    case 'touch':
    case 'handshake':
      return [event.aId, event.bId];
    case 'stab':
      return [event.attackerId, event.victimId];
    case 'peaceCry':
      return [event.emitterId];
    case 'death':
      return event.killerId !== undefined ? [event.entityId, event.killerId] : [event.entityId];
    case 'birth':
      return [event.childId, event.motherId];
    case 'regularized':
      return [event.entityId];
    default:
      return [];
  }
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
