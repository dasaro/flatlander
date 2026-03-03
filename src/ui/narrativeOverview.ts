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
  recentStabs?: number;
  recentPeaceCries?: number;
  notableEvents?: string[];
  recentWindowTicks?: number;
}

export interface NarrativeOverview {
  headline: string;
  bulletinLine: string;
  reasons: string[];
}

const NARRATIVE_EVENT_TYPES: EventType[] = [
  'peaceCryComplianceHalt',
  'yieldToLady',
  'handshakeAttemptFailed',
  'handshake',
  'houseEnter',
  'houseExit',
  'inspectionHospitalized',
  'inspectionExecuted',
  'policyShift',
  'stab',
  'peaceCry',
  'death',
  'birth',
  'regularized',
];
const BULLETIN_ROTATION_TICKS = 180;

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

function describePolicyShiftReason(reason: string): string {
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
      return 'restored stability';
    default:
      return reason;
  }
}

function pickByTick(tick: number, options: string[]): string {
  if (options.length === 0) {
    return '';
  }
  const index = Math.floor(Math.max(0, tick) / BULLETIN_ROTATION_TICKS) % options.length;
  return options[index] ?? options[0] ?? '';
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
    peaceCryComplianceHalt: 0,
    yieldToLady: 0,
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
    inspectionHospitalized: 0,
    inspectionExecuted: 0,
    policyShift: 0,
    regularized: 0,
  };
  const reasonsByType: Record<EventType, Record<string, number>> = {
    peaceCryComplianceHalt: {},
    yieldToLady: {},
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
    inspectionHospitalized: {},
    inspectionExecuted: {},
    policyShift: {},
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
  const inspectedHospitalized = recent.countsByType.inspectionHospitalized;
  const inspectionExecuted = recent.countsByType.inspectionExecuted;
  const policyShifts = recent.countsByType.policyShift;
  const yieldEvents = recent.countsByType.yieldToLady;
  const cryHalts = recent.countsByType.peaceCryComplianceHalt;
  const stabs = Math.max(recent.countsByType.stab, Math.max(0, Math.round(input.recentStabs ?? 0)));
  const peaceCries = Math.max(
    recent.countsByType.peaceCry,
    Math.max(0, Math.round(input.recentPeaceCries ?? 0)),
  );
  const shelterCoverage =
    (input.insidePeople + input.seekingShelter + input.seekingHome) / Math.max(1, input.totalPeople);

  let headline = 'Transit phase: population pressure is near balance.';
  if (input.isRaining && shelterCoverage >= 0.7) {
    headline = 'Rain phase: most inhabitants are sheltering or moving to doors.';
  } else if (input.isRaining) {
    headline = 'Rain phase: shelter demand is active but many inhabitants remain exposed.';
  } else if (inspectionExecuted >= Math.max(1, births)) {
    headline = 'Inspection crackdown: coercive policy is driving visible losses.';
  } else if (policyShifts > 0) {
    headline = 'Policy transition: civic rules are actively shifting this interval.';
  } else if (stabs >= Math.max(2, births + 1)) {
    headline = 'Street tension phase: sharp contacts are dominating civic traffic.';
  } else if (deaths > births * 1.25 && deaths > 0) {
    headline = 'Crisis phase: losses currently exceed births.';
  } else if (births > deaths * 1.25 && births > 0) {
    headline = 'Recovery phase: births currently outpace losses.';
  }

  const reasonCandidates: Array<{ score: number; text: string }> = [];
  if (input.isRaining) {
    reasonCandidates.push({
      score: 0.95,
      text: `Rain is active; ${input.insidePeople + input.seekingShelter + input.seekingHome}/${input.totalPeople} are inside or explicitly seeking shelter.`,
    });
  } else {
    reasonCandidates.push({
      score: 0.5,
      text: `Dry phase; ${input.insidePeople}/${input.totalPeople} remain indoors while ${input.outsidePeople} stay active outside.`,
    });
  }

  const topEntryReason = topReason(recent.reasonsByType.houseEnter);
  if (topEntryReason) {
    reasonCandidates.push({
      score: input.isRaining ? 0.9 : 0.72,
      text: `House entries are mainly driven by ${describeHouseReason(topEntryReason.reason)} (${topEntryReason.count} recent events).`,
    });
  }

  const topPolicyShiftReason = topReason(recent.reasonsByType.policyShift);
  if (policyShifts > 0 && topPolicyShiftReason) {
    reasonCandidates.push({
      score: 0.91,
      text: `Policy desk: ${policyShifts} regime shift events, led by ${describePolicyShiftReason(topPolicyShiftReason.reason)} (${topPolicyShiftReason.count}x).`,
    });
  }

  if (inspectedHospitalized > 0 || inspectionExecuted > 0) {
    reasonCandidates.push({
      score: inspectionExecuted > 0 ? 0.93 : 0.74,
      text: `Inspection office: ${inspectedHospitalized} hospitalizations and ${inspectionExecuted} executions in the recent window.`,
    });
  }

  const handshakeOk = recent.countsByType.handshake;
  const handshakeFail = recent.countsByType.handshakeAttemptFailed;
  const topHandshakeFailure = topReason(recent.reasonsByType.handshakeAttemptFailed);
  if (handshakeFail > 0 && topHandshakeFailure) {
    reasonCandidates.push({
      score: 0.92,
      text: `Social recognition: ${handshakeOk} completed vs ${handshakeFail} failed; dominant failure reason is ${describeHandshakeFailureReason(topHandshakeFailure.reason)}.`,
    });
  } else {
    reasonCandidates.push({
      score: handshakeOk > 0 ? 0.62 : 0.35,
      text: `Social recognition: ${handshakeOk} successful handshakes in the recent window.`,
    });
  }

  if (yieldEvents > 0 || cryHalts > 0) {
    reasonCandidates.push({
      score: 0.78,
      text: `Etiquette protocol: ${yieldEvents} yield-to-lady responses and ${cryHalts} peace-cry compliance halts in the recent window.`,
    });
  }

  reasonCandidates.push({
    score: Math.max(0.55, deaths > births ? 0.88 : births > deaths ? 0.84 : 0.68),
    text: `Demography (recent): births ${births}, deaths ${deaths}. Stuck-near-house count this tick: ${input.stuckNearHouse}.`,
  });

  reasonCandidates.push({
    score: stabs > Math.max(2, births + 1) ? 0.87 : 0.52,
    text: `Notable events (recent): house entries ${houseEnter}, exits ${houseExit}, stabs ${stabs}, peace-cries ${peaceCries}, regularizations ${regularized}, policy shifts ${policyShifts}.`,
  });

  const notableEvents = input.notableEvents ?? [];
  let bulletinLine = '';
  if (notableEvents.length > 0) {
    const rotationIndex =
      Math.floor(Math.max(0, input.tick) / BULLETIN_ROTATION_TICKS) % notableEvents.length;
    const selected = notableEvents[rotationIndex] ?? notableEvents[0] ?? '';
    const socialTag = input.isRaining
      ? `${input.insidePeople + input.seekingShelter}/${Math.max(1, input.totalPeople)} sheltering in rain`
      : `${births} births vs ${deaths} deaths; ${stabs} sharp clashes`;
    bulletinLine = `Gazette: ${selected} (${socialTag}).`;
    reasonCandidates.push({
      score: 0.83,
      text: `Latest notable: ${notableEvents.slice(0, 2).join(' | ')}`,
    });
  } else if (deaths > births && deaths > 0) {
    bulletinLine = pickByTick(input.tick, [
      `Gazette: crisis watch reports ${deaths} deaths against ${births} births.`,
      `Gazette: obituary desk is busier than the birth desk (${deaths} to ${births}).`,
      `Gazette: hard day for households: ${deaths} losses, ${births} arrivals.`,
    ]);
  } else if (births > deaths && births > 0) {
    bulletinLine = pickByTick(input.tick, [
      `Gazette: recovery column says ${births} births now outpace ${deaths} deaths.`,
      `Gazette: nurseries win this round (${births} arrivals, ${deaths} departures).`,
      `Gazette: census clerks are smiling: +${Math.max(0, births - deaths)} net lately.`,
    ]);
  } else if (policyShifts > 0 || inspectedHospitalized > 0 || inspectionExecuted > 0) {
    bulletinLine = pickByTick(input.tick, [
      `Gazette: inspection teams logged ${inspectedHospitalized} hospitalizations and ${inspectionExecuted} executions under ${policyShifts} policy shifts.`,
      `Gazette: civic regime churn continues (${policyShifts} shifts); inspectors moved ${inspectedHospitalized} cases and closed ${inspectionExecuted}.`,
      `Gazette: policy desk reports ${policyShifts} shifts with inspection outcomes ${inspectedHospitalized}/${inspectionExecuted} (hospitalized/executed).`,
    ]);
  } else if (input.isRaining) {
    bulletinLine = pickByTick(input.tick, [
      'Gazette: rain keeps streets tense as households race for shelter.',
      'Gazette: umbrellas unavailable; door queues are the city sport of the hour.',
      'Gazette: wet weather edition: shelter protocols are running citywide.',
    ]);
  } else if (stabs > 0 || peaceCries > 0) {
    bulletinLine = pickByTick(input.tick, [
      `Gazette: safety desk logged ${stabs} sharp contacts and ${peaceCries} peace-cry calls.`,
      `Gazette: traffic was noisy: ${peaceCries} warnings and ${stabs} pointed altercations.`,
      `Gazette: patrol update: ${stabs} stabs, ${peaceCries} alerts; no calm vote yet.`,
    ]);
  } else {
    bulletinLine = pickByTick(input.tick, [
      'Gazette: routine civic traffic; no major disruption reported.',
      'Gazette: a quiet interval, by Flatland standards.',
      'Gazette: municipal calm holds for now.',
    ]);
  }

  reasonCandidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.text.localeCompare(right.text);
  });
  const reasons = reasonCandidates.slice(0, 3).map((candidate) => candidate.text);

  return {
    bulletinLine,
    headline,
    reasons,
  };
}
