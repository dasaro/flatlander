import type { WorldEvent } from '../core/events';
import { eventInvolvedIds } from '../core/events';
import { KNOWN_RANK_KEYS } from '../core/rankKey';

export type EventType = WorldEvent['type'];

export interface TickSummary {
  tick: number;
  countsByType: Record<EventType, number>;
  countsByRankKey: Record<string, number>;
  byTypeByRankKey: Record<EventType, Record<string, number>>;
  involvedIds: Set<number>;
}

interface StoredEvent {
  type: EventType;
  rankKeys: string[];
  involvedIds: number[];
}

interface TickBucket {
  tick: number;
  events: StoredEvent[];
}

export interface TimelineFilter {
  selectedTypes: Set<EventType>;
  selectedRankKeys: Set<string>;
  splitByRank: boolean;
  focusEntityId: number | null;
}

const EVENT_TYPES: EventType[] = [
  'handshake',
  'stab',
  'death',
  'birth',
  'regularized',
];

function emptyCountsByType(): Record<EventType, number> {
  return {
    touch: 0,
    handshake: 0,
    peaceCry: 0,
    stab: 0,
    death: 0,
    birth: 0,
    regularized: 0,
  };
}

function emptyByTypeByRank(): Record<EventType, Record<string, number>> {
  return {
    touch: {},
    handshake: {},
    peaceCry: {},
    stab: {},
    death: {},
    birth: {},
    regularized: {},
  };
}

function rankKeysForEvent(event: WorldEvent): string[] {
  switch (event.type) {
    case 'touch':
    case 'handshake':
      return [event.aRankKey ?? 'Unknown', event.bRankKey ?? 'Unknown'];
    case 'peaceCry':
      return [event.emitterRankKey ?? 'Unknown'];
    case 'stab':
      return [event.attackerRankKey ?? 'Unknown', event.victimRankKey ?? 'Unknown'];
    case 'death':
      return [event.rankKey ?? 'Unknown'];
    case 'birth':
      return [event.childRankKey ?? 'Unknown', event.motherRankKey ?? 'Unknown'];
    case 'regularized':
      return [event.rankKey ?? 'Unknown'];
    default:
      return ['Unknown'];
  }
}

export class EventAnalytics {
  private readonly maxEventfulTicks: number;
  private readonly buckets: TickBucket[] = [];

  constructor(maxEventfulTicks = 1500) {
    this.maxEventfulTicks = Math.max(32, Math.round(maxEventfulTicks));
  }

  clear(): void {
    this.buckets.length = 0;
  }

  ingest(events: WorldEvent[]): void {
    if (events.length === 0) {
      return;
    }

    const byTick = new Map<number, StoredEvent[]>();
    for (const event of events) {
      if (event.type === 'peaceCry' || event.type === 'touch') {
        // Peace-cry and touch events are too dense for timeline analysis; keep them in visual effects only.
        continue;
      }
      const storedEvents = byTick.get(event.tick) ?? [];
      storedEvents.push({
        type: event.type,
        rankKeys: rankKeysForEvent(event),
        involvedIds: eventInvolvedIds(event),
      });
      byTick.set(event.tick, storedEvents);
    }

    const ticks = [...byTick.keys()].sort((a, b) => a - b);
    for (const tick of ticks) {
      const eventsForTick = byTick.get(tick);
      if (!eventsForTick || eventsForTick.length === 0) {
        continue;
      }
      const existing = this.buckets.find((bucket) => bucket.tick === tick);
      if (existing) {
        existing.events.push(...eventsForTick);
      } else {
        this.buckets.push({
          tick,
          events: [...eventsForTick],
        });
      }
    }

    this.buckets.sort((a, b) => a.tick - b.tick);
    if (this.buckets.length > this.maxEventfulTicks) {
      this.buckets.splice(0, this.buckets.length - this.maxEventfulTicks);
    }
  }

  getObservedRankKeys(): string[] {
    const keys = new Set<string>(KNOWN_RANK_KEYS);
    for (const bucket of this.buckets) {
      for (const event of bucket.events) {
        for (const rankKey of event.rankKeys) {
          keys.add(rankKey);
        }
      }
    }

    return [...keys].sort((a, b) => a.localeCompare(b));
  }

  getFilteredSummaries(filter: TimelineFilter): TickSummary[] {
    const result: TickSummary[] = [];
    const selectedTypes = filter.selectedTypes.size > 0 ? filter.selectedTypes : new Set(EVENT_TYPES);
    const selectedRanks = filter.selectedRankKeys.size > 0 ? filter.selectedRankKeys : null;

    for (const bucket of this.buckets) {
      let keep = false;
      const countsByType = emptyCountsByType();
      const countsByRankKey: Record<string, number> = {};
      const byTypeByRankKey = emptyByTypeByRank();
      const involvedIds = new Set<number>();

      for (const event of bucket.events) {
        if (!selectedTypes.has(event.type)) {
          continue;
        }
        if (
          filter.focusEntityId !== null &&
          !event.involvedIds.includes(filter.focusEntityId)
        ) {
          continue;
        }

        let rankKeys = event.rankKeys;
        if (selectedRanks) {
          rankKeys = rankKeys.filter((rankKey) => selectedRanks.has(rankKey));
          if (rankKeys.length === 0) {
            continue;
          }
          countsByType[event.type] += rankKeys.length;
        } else {
          countsByType[event.type] += 1;
        }

        for (const rankKey of rankKeys) {
          countsByRankKey[rankKey] = (countsByRankKey[rankKey] ?? 0) + 1;
          byTypeByRankKey[event.type][rankKey] =
            (byTypeByRankKey[event.type][rankKey] ?? 0) + 1;
        }

        for (const involvedId of event.involvedIds) {
          involvedIds.add(involvedId);
        }

        if (selectedRanks && rankKeys.length === 0) {
          continue;
        }
        keep = true;
      }

      if (!keep) {
        continue;
      }

      result.push({
        tick: bucket.tick,
        countsByType,
        countsByRankKey,
        byTypeByRankKey,
        involvedIds,
      });
    }

    return result;
  }
}
