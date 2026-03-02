import type { EventType, TickSummary } from './eventAnalytics';

export interface NarrativeOverviewInput {
  tick: number;
  isRaining: boolean;
  totalPeople: number;
  outsidePeople: number;
  insidePeople: number;
  seekingShelter: number;
  seekingHome: number;
  stuckNearHouse: number;
  notableEvents?: string[];
  recentWindowTicks?: number;
}

export interface NarrativeOverview {
  headline: string;
  bulletinLine: string;
  reasons: string[];
}

const NARRATIVE_EVENT_TYPES: EventType[] = [
  'handshakeAttemptFailed',
  'handshake',
  'houseEnter',
  'houseExit',
  'death',
  'birth',
  'regularized',
];

function topReason(reasons: Record<string, number>): { reason: string; count: number } | null {
  const entries = Object.entries(reasons).filter((entry) => entry[1] > 0);
  if (entries.length === 0) {
    return null;
  }
  entries.sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }
    return left[0].localeCompare(right[0]);
  });
  const first = entries[0];
  return first ? { reason: first[0], count: first[1] } : null;
}

function describeHouseReason(reason: string): string {
  switch (reason) {
    case 'RainShelter':
      return 'rain sheltering';
    case 'ReturnHome':
      return 'return-home behavior';
    case 'Healing':
      return 'healing needs';
    case 'AvoidCrowd':
      return 'crowd avoidance';
    case 'WaitForBearing':
      return 'bearing checks';
    case 'Wander':
      return 'wandering';
    default:
      return reason;
  }
}

function describeHandshakeFailureReason(reason: string): string {
  switch (reason) {
    case 'PartnerMissing':
      return 'the partner disappeared before completion';
    case 'StillnessNotSatisfied':
      return 'stillness protocol was not satisfied';
    case 'KnowledgeNotEstablished':
      return 'knowledge transfer did not complete in time';
    default:
      return reason;
  }
}

function aggregateRecent(
  summaries: TickSummary[],
  tick: number,
  windowTicks: number,
): {
  countsByType: Record<EventType, number>;
  reasonsByType: Record<EventType, Record<string, number>>;
} {
  const countsByType: Record<EventType, number> = {
    handshakeStart: 0,
    handshakeAttemptFailed: 0,
    touch: 0,
    handshake: 0,
    peaceCry: 0,
    stab: 0,
    death: 0,
    birth: 0,
    houseEnter: 0,
    houseExit: 0,
    regularized: 0,
  };
  const reasonsByType: Record<EventType, Record<string, number>> = {
    handshakeStart: {},
    handshakeAttemptFailed: {},
    touch: {},
    handshake: {},
    peaceCry: {},
    stab: {},
    death: {},
    birth: {},
    houseEnter: {},
    houseExit: {},
    regularized: {},
  };

  const minTick = Math.max(0, tick - windowTicks);
  for (const summary of summaries) {
    if (summary.tick < minTick) {
      continue;
    }
    for (const type of NARRATIVE_EVENT_TYPES) {
      countsByType[type] += summary.countsByType[type] ?? 0;
      const reasons = summary.reasonsByType[type] ?? {};
      for (const [reason, count] of Object.entries(reasons)) {
        reasonsByType[type][reason] = (reasonsByType[type][reason] ?? 0) + count;
      }
    }
  }

  return { countsByType, reasonsByType };
}

export function buildNarrativeOverview(
  input: NarrativeOverviewInput,
  summaries: TickSummary[],
): NarrativeOverview {
  if (input.totalPeople <= 0) {
    return {
      bulletinLine: 'Gazette: the city is empty; no active citizens remain.',
      headline: 'Population collapsed: no inhabitants remain.',
      reasons: ['No active agents are available to reproduce, shelter, or maintain social exchange.'],
    };
  }

  const windowTicks = Math.max(300, Math.round(input.recentWindowTicks ?? 900));
  const recent = aggregateRecent(summaries, input.tick, windowTicks);
  const births = recent.countsByType.birth;
  const deaths = recent.countsByType.death;
  const regularized = recent.countsByType.regularized;
  const houseEnter = recent.countsByType.houseEnter;
  const houseExit = recent.countsByType.houseExit;
  const shelterCoverage =
    (input.insidePeople + input.seekingShelter + input.seekingHome) / Math.max(1, input.totalPeople);

  let headline = 'Transit phase: population pressure is near balance.';
  if (input.isRaining && shelterCoverage >= 0.7) {
    headline = 'Rain phase: most inhabitants are sheltering or moving to doors.';
  } else if (input.isRaining) {
    headline = 'Rain phase: shelter demand is active but many inhabitants remain exposed.';
  } else if (deaths > births * 1.25 && deaths > 0) {
    headline = 'Crisis phase: losses currently exceed births.';
  } else if (births > deaths * 1.25 && births > 0) {
    headline = 'Recovery phase: births currently outpace losses.';
  }

  const reasons: string[] = [];
  if (input.isRaining) {
    reasons.push(
      `Rain is active; ${input.insidePeople + input.seekingShelter + input.seekingHome}/${input.totalPeople} are inside or explicitly seeking shelter.`,
    );
  } else {
    reasons.push(
      `Dry phase; ${input.insidePeople}/${input.totalPeople} remain indoors while ${input.outsidePeople} stay active outside.`,
    );
  }

  const topEntryReason = topReason(recent.reasonsByType.houseEnter);
  if (topEntryReason) {
    reasons.push(
      `House entries are mainly driven by ${describeHouseReason(topEntryReason.reason)} (${topEntryReason.count} recent events).`,
    );
  }

  const handshakeOk = recent.countsByType.handshake;
  const handshakeFail = recent.countsByType.handshakeAttemptFailed;
  const topHandshakeFailure = topReason(recent.reasonsByType.handshakeAttemptFailed);
  if (handshakeFail > 0 && topHandshakeFailure) {
    reasons.push(
      `Social recognition: ${handshakeOk} completed vs ${handshakeFail} failed; dominant failure reason is ${describeHandshakeFailureReason(topHandshakeFailure.reason)}.`,
    );
  } else {
    reasons.push(`Social recognition: ${handshakeOk} successful handshakes in the recent window.`);
  }

  reasons.push(
    `Demography (recent): births ${births}, deaths ${deaths}. Stuck-near-house count this tick: ${input.stuckNearHouse}.`,
  );

  reasons.push(
    `Notable events (recent): house entries ${houseEnter}, exits ${houseExit}, regularizations ${regularized}.`,
  );

  const notableEvents = input.notableEvents ?? [];
  let bulletinLine = '';
  if (notableEvents.length > 0) {
    bulletinLine = `Gazette: ${notableEvents[0]}`;
    reasons.push(`Latest notable: ${notableEvents.slice(0, 2).join(' | ')}`);
  } else if (deaths > births && deaths > 0) {
    bulletinLine = `Gazette: crisis pressure dominates (${deaths} recent deaths vs ${births} births).`;
  } else if (births > deaths && births > 0) {
    bulletinLine = `Gazette: recovery signals (${births} births outpace ${deaths} deaths).`;
  } else if (input.isRaining) {
    bulletinLine = 'Gazette: rain keeps streets tense as households race for shelter.';
  } else {
    bulletinLine = 'Gazette: routine civic traffic; no major disruption reported.';
  }

  return {
    bulletinLine,
    headline,
    reasons: reasons.slice(0, 5),
  };
}
