import type { WorldEvent } from '../core/events';

export interface RecentNarrativeItem {
  tick: number;
  text: string;
  type: WorldEvent['type'];
  entityIds: number[];
}

interface StoredNarrativeItem extends RecentNarrativeItem {
  score: number;
}

function houseReasonLabel(reason: string): string {
  switch (reason) {
    case 'RainShelter':
      return 'rain sheltering';
    case 'ReturnHome':
      return 'returning home';
    case 'Healing':
      return 'healing';
    case 'AvoidCrowd':
      return 'avoiding crowd pressure';
    case 'WaitForBearing':
      return 'waiting for bearings';
    case 'Wander':
      return 'wandering indoors';
    default:
      return reason;
  }
}

function handshakeFailureLabel(reason: string): string {
  switch (reason) {
    case 'PartnerMissing':
      return 'partner missing';
    case 'StillnessNotSatisfied':
      return 'stillness protocol not satisfied';
    case 'KnowledgeNotEstablished':
      return 'knowledge transfer incomplete';
    default:
      return reason;
  }
}

function scoreForType(type: WorldEvent['type']): number {
  switch (type) {
    case 'death':
      return 6;
    case 'regularized':
      return 5;
    case 'birth':
      return 4;
    case 'houseEnter':
    case 'houseExit':
      return 3;
    case 'handshakeAttemptFailed':
      return 2;
    case 'handshake':
      return 1;
    default:
      return 0;
  }
}

function eventToNarrativeItem(event: WorldEvent): StoredNarrativeItem | null {
  switch (event.type) {
    case 'birth':
      return {
        tick: event.tick,
        text: `Birth desk: ${event.childRankKey ?? 'A child'} #${event.childId} was born to #${event.motherId}.`,
        type: event.type,
        entityIds: [event.childId, event.motherId],
        score: scoreForType(event.type),
      };
    case 'death':
      return {
        tick: event.tick,
        text:
          event.killerId === undefined
            ? `Obituary: ${event.rankKey ?? 'an inhabitant'} #${event.entityId} has died.`
            : `Crime watch: ${event.rankKey ?? 'an inhabitant'} #${event.entityId} was slain by #${event.killerId}.`,
        type: event.type,
        entityIds: event.killerId === undefined ? [event.entityId] : [event.entityId, event.killerId],
        score: scoreForType(event.type),
      };
    case 'regularized':
      return {
        tick: event.tick,
        text: `Civic registry: #${event.entityId} regularized into ${event.rankKey ?? 'a regular rank'}.`,
        type: event.type,
        entityIds: [event.entityId],
        score: scoreForType(event.type),
      };
    case 'houseEnter':
      return {
        tick: event.tick,
        text: `Shelter report: #${event.entityId} entered house #${event.houseId} for ${houseReasonLabel(event.reason)}.`,
        type: event.type,
        entityIds: [event.entityId, event.houseId],
        score: scoreForType(event.type),
      };
    case 'houseExit':
      return {
        tick: event.tick,
        text: `Street report: #${event.entityId} exited house #${event.houseId} after ${houseReasonLabel(event.reason)}.`,
        type: event.type,
        entityIds: [event.entityId, event.houseId],
        score: scoreForType(event.type),
      };
    case 'handshake':
      return {
        tick: event.tick,
        text: `Society column: #${event.aId} and #${event.bId} completed a formal recognition.`,
        type: event.type,
        entityIds: [event.aId, event.bId],
        score: scoreForType(event.type),
      };
    case 'handshakeAttemptFailed':
      return {
        tick: event.tick,
        text: `Etiquette note: introduction between #${event.aId} and #${event.bId} failed (${handshakeFailureLabel(event.reason)}).`,
        type: event.type,
        entityIds: [event.aId, event.bId],
        score: scoreForType(event.type),
      };
    default:
      return null;
  }
}

export class RecentEventNarrativeStore {
  private readonly items: StoredNarrativeItem[] = [];

  constructor(private readonly maxItems = 1200) {}

  clear(): void {
    this.items.length = 0;
  }

  ingest(events: WorldEvent[]): void {
    for (const event of events) {
      const item = eventToNarrativeItem(event);
      if (!item) {
        continue;
      }
      this.items.push(item);
    }
    if (this.items.length > this.maxItems) {
      this.items.splice(0, this.items.length - this.maxItems);
    }
  }

  getEntityHighlights(
    entityId: number,
    currentTick: number,
    limit = 2,
    windowTicks = 3000,
    resolveEntityLabel?: (id: number) => string | null,
  ): RecentNarrativeItem[] {
    const minTick = Math.max(0, currentTick - Math.max(1, Math.round(windowTicks)));
    const relevant = this.items.filter(
      (item) => item.tick >= minTick && item.entityIds.includes(entityId),
    );
    relevant.sort((left, right) => {
      if (right.tick !== left.tick) {
        return right.tick - left.tick;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.text.localeCompare(right.text);
    });
    return relevant
      .slice(0, Math.max(1, Math.round(limit)))
      .map((item) => this.toPublicItem(item, resolveEntityLabel));
  }

  getGlobalHighlights(
    currentTick: number,
    limit = 3,
    windowTicks = 1800,
    resolveEntityLabel?: (id: number) => string | null,
  ): RecentNarrativeItem[] {
    const minTick = Math.max(0, currentTick - Math.max(1, Math.round(windowTicks)));
    const relevant = this.items.filter((item) => item.tick >= minTick);
    relevant.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.tick !== left.tick) {
        return right.tick - left.tick;
      }
      return left.text.localeCompare(right.text);
    });
    return relevant
      .slice(0, Math.max(1, Math.round(limit)))
      .map((item) => this.toPublicItem(item, resolveEntityLabel));
  }

  private toPublicItem(
    item: StoredNarrativeItem,
    resolveEntityLabel?: (id: number) => string | null,
  ): RecentNarrativeItem {
    const text = this.renderText(item.text, resolveEntityLabel);
    return {
      tick: item.tick,
      text,
      type: item.type,
      entityIds: [...item.entityIds],
    };
  }

  private renderText(
    text: string,
    resolveEntityLabel?: (id: number) => string | null,
  ): string {
    if (!resolveEntityLabel) {
      return text;
    }
    return text.replace(/#(\d+)/g, (_match, idText: string) => {
      const id = Number.parseInt(idText, 10);
      if (!Number.isFinite(id)) {
        return `#${idText}`;
      }
      const label = resolveEntityLabel(id);
      return label && label.trim().length > 0 ? label : `#${id}`;
    });
  }
}
