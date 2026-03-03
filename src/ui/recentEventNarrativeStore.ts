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

function hashKey(parts: number[]): number {
  let value = 0x811c9dc5;
  for (const part of parts) {
    value ^= part | 0;
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function pickTemplate(parts: number[], templates: string[]): string {
  if (templates.length === 0) {
    return '';
  }
  const index = hashKey(parts) % templates.length;
  return templates[index] ?? templates[0] ?? '';
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

function policyShiftReasonLabel(reason: string): string {
  switch (reason) {
    case 'IrregularitySpike':
      return 'an irregularity spike';
    case 'Overcrowding':
      return 'overcrowding pressure';
    case 'SuppressionOrder':
      return 'a suppression order';
    case 'Deescalation':
      return 'de-escalation';
    case 'StabilityRestored':
      return 'stability restoration';
    default:
      return reason;
  }
}

function scoreForType(type: WorldEvent['type']): number {
  switch (type) {
    case 'peaceCryComplianceHalt':
    case 'yieldToLady':
      return 2;
    case 'inspectionExecuted':
      return 7;
    case 'policyShift':
      return 6;
    case 'inspectionHospitalized':
      return 5;
    case 'death':
      return 6;
    case 'regularized':
      return 5;
    case 'birth':
      return 4;
    case 'stab':
      return 4;
    case 'houseEnter':
    case 'houseExit':
      return 3;
    case 'handshakeAttemptFailed':
      return 2;
    case 'handshake':
    case 'peaceCry':
      return 1;
    default:
      return 0;
  }
}

function eventToNarrativeItem(event: WorldEvent): StoredNarrativeItem | null {
  switch (event.type) {
    case 'peaceCryComplianceHalt': {
      const text = pickTemplate(
        [event.tick, event.entityId],
        [
          `Safety desk: #${event.entityId} was halted for moving without an active peace-cry.`,
          `Traffic note: #${event.entityId} paused to restore peace-cry compliance.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.entityId],
        score: scoreForType(event.type),
      };
    }
    case 'yieldToLady': {
      const text = pickTemplate(
        [event.tick, event.entityId, event.womanId],
        [
          `Etiquette desk: #${event.entityId} yielded right of way to #${event.womanId}.`,
          `Street manners: #${event.entityId} paused and gave way to #${event.womanId}.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.entityId, event.womanId],
        score: scoreForType(event.type),
      };
    }
    case 'birth': {
      const text = pickTemplate(
        [event.tick, event.childId, event.motherId],
        [
          `Birth desk: ${event.childRankKey ?? 'A child'} #${event.childId} arrived, and #${event.motherId} now runs a larger household.`,
          `Morning bulletin: #${event.motherId} introduced newborn #${event.childId}; census clerks are busy again.`,
          `Civic registry: #${event.childId} joined the streets under the care of #${event.motherId}.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.childId, event.motherId],
        score: scoreForType(event.type),
      };
    }
    case 'death': {
      const text =
        event.killerId === undefined
          ? pickTemplate(
              [event.tick, event.entityId],
              [
                `Obituary: ${event.rankKey ?? 'an inhabitant'} #${event.entityId} has left the city.`,
                `Evening notice: #${event.entityId} is no longer among the living.`,
                `Gazette desk: #${event.entityId} closed a long chapter today.`,
              ],
            )
          : pickTemplate(
              [event.tick, event.entityId, event.killerId],
              [
                `Crime watch: ${event.rankKey ?? 'an inhabitant'} #${event.entityId} fell in a clash with #${event.killerId}.`,
                `Street report: #${event.killerId} ended the run of #${event.entityId}.`,
                `Late edition: #${event.entityId} was slain by #${event.killerId}; wardens are taking notes.`,
              ],
            );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: event.killerId === undefined ? [event.entityId] : [event.entityId, event.killerId],
        score: scoreForType(event.type),
      };
    }
    case 'regularized': {
      const text = pickTemplate(
        [event.tick, event.entityId],
        [
          `Civic registry: #${event.entityId} regularized into ${event.rankKey ?? 'a regular rank'}.`,
          `Reform column: #${event.entityId} completed regularization and now presents as ${event.rankKey ?? 'regular'}.`,
          `Public record: #${event.entityId} is now certified ${event.rankKey ?? 'regular'}.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.entityId],
        score: scoreForType(event.type),
      };
    }
    case 'houseEnter': {
      const text = pickTemplate(
        [event.tick, event.entityId, event.houseId],
        [
          `Shelter report: #${event.entityId} entered house #${event.houseId} for ${houseReasonLabel(event.reason)}.`,
          `Housing desk: #${event.entityId} slipped into house #${event.houseId} for ${houseReasonLabel(event.reason)}.`,
          `Street column: #${event.entityId} secured cover in house #${event.houseId} (${houseReasonLabel(event.reason)}).`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.entityId, event.houseId],
        score: scoreForType(event.type),
      };
    }
    case 'houseExit': {
      const text = pickTemplate(
        [event.tick, event.entityId, event.houseId],
        [
          `Street report: #${event.entityId} exited house #${event.houseId} after ${houseReasonLabel(event.reason)}.`,
          `Housing desk: #${event.entityId} stepped out of house #${event.houseId} following ${houseReasonLabel(event.reason)}.`,
          `Morning traffic: #${event.entityId} left house #${event.houseId} once ${houseReasonLabel(event.reason)} was settled.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.entityId, event.houseId],
        score: scoreForType(event.type),
      };
    }
    case 'inspectionHospitalized': {
      const text = pickTemplate(
        [event.tick, event.entityId],
        [
          `Inspection desk: #${event.entityId} was sent to hospital ward for deviation ${event.deviationDeg.toFixed(2)}°.`,
          `Civic order: inspectors confined #${event.entityId} for ${event.durationTicks} ticks after measuring ${event.deviationDeg.toFixed(2)}° deviation.`,
          `Public bulletin: #${event.entityId} entered treatment under inspection review (${event.deviationDeg.toFixed(2)}°).`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.entityId],
        score: scoreForType(event.type),
      };
    }
    case 'inspectionExecuted': {
      const text = pickTemplate(
        [event.tick, event.entityId],
        [
          `Inspection docket: #${event.entityId} was condemned after a ${event.deviationDeg.toFixed(2)}° reading.`,
          `Late edition: inspectors executed #${event.entityId} over severe irregularity (${event.deviationDeg.toFixed(2)}°).`,
          `Policy watch: #${event.entityId} fell to inspection enforcement (${event.deviationDeg.toFixed(2)}°).`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.entityId],
        score: scoreForType(event.type),
      };
    }
    case 'policyShift': {
      const text = pickTemplate(
        [event.tick],
        [
          `Council note: the city shifted into ${event.phase} phase due to ${policyShiftReasonLabel(event.reason)}.`,
          `Government circular: regime moved to ${event.phase} following ${policyShiftReasonLabel(event.reason)}.`,
          `Front page: policy entered ${event.phase} mode as officials cited ${policyShiftReasonLabel(event.reason)}.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [],
        score: scoreForType(event.type),
      };
    }
    case 'handshake': {
      const text = pickTemplate(
        [event.tick, event.aId, event.bId],
        [
          `Society column: #${event.aId} and #${event.bId} completed a formal recognition.`,
          `Etiquette desk: #${event.aId} and #${event.bId} finished a successful tactile introduction.`,
          `Civic manners: #${event.aId} and #${event.bId} now recognize each other on contact.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.aId, event.bId],
        score: scoreForType(event.type),
      };
    }
    case 'handshakeAttemptFailed': {
      const text = pickTemplate(
        [event.tick, event.aId, event.bId],
        [
          `Etiquette note: introduction between #${event.aId} and #${event.bId} failed (${handshakeFailureLabel(event.reason)}).`,
          `Society column: #${event.aId} could not conclude recognition with #${event.bId} (${handshakeFailureLabel(event.reason)}).`,
          `Manners desk: #${event.aId} and #${event.bId} postponed contact protocol (${handshakeFailureLabel(event.reason)}).`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.aId, event.bId],
        score: scoreForType(event.type),
      };
    }
    case 'stab': {
      const intensity =
        event.sharpness >= 0.8
          ? 'severe'
          : event.sharpness >= 0.45
            ? 'hard'
            : 'glancing';
      const text = pickTemplate(
        [event.tick, event.attackerId, event.victimId],
        [
          `Crime blotter: #${event.attackerId} delivered a ${intensity} stab contact to #${event.victimId}.`,
          `Street watch: #${event.victimId} took a ${intensity} hit from #${event.attackerId}.`,
          `Public safety: a ${intensity} vertex clash occurred between #${event.attackerId} and #${event.victimId}.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.attackerId, event.victimId],
        score: scoreForType(event.type),
      };
    }
    case 'peaceCry': {
      const text = pickTemplate(
        [event.tick, event.emitterId],
        [
          `Signal desk: #${event.emitterId} issued a peace-cry warning.`,
          `Civic alert: #${event.emitterId} broadcast a peace-cry for nearby traffic.`,
        ],
      );
      return {
        tick: event.tick,
        text,
        type: event.type,
        entityIds: [event.emitterId],
        score: scoreForType(event.type),
      };
    }
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
    const denseCaps: Partial<Record<WorldEvent['type'], number>> = {
      peaceCry: 2,
      stab: 4,
      policyShift: 1,
    };
    const denseCounts: Partial<Record<WorldEvent['type'], number>> = {};
    for (const event of events) {
      const cap = denseCaps[event.type];
      if (cap !== undefined) {
        const used = denseCounts[event.type] ?? 0;
        if (used >= cap) {
          continue;
        }
        denseCounts[event.type] = used + 1;
      }
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

  countByType(
    currentTick: number,
    windowTicks = 1800,
    types?: WorldEvent['type'][],
  ): Partial<Record<WorldEvent['type'], number>> {
    const minTick = Math.max(0, currentTick - Math.max(1, Math.round(windowTicks)));
    const typeFilter = types ? new Set(types) : null;
    const counts: Partial<Record<WorldEvent['type'], number>> = {};
    for (const item of this.items) {
      if (item.tick < minTick) {
        continue;
      }
      if (typeFilter && !typeFilter.has(item.type)) {
        continue;
      }
      counts[item.type] = (counts[item.type] ?? 0) + 1;
    }
    return counts;
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
