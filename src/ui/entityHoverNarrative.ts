import type { SocialNavMovement } from '../core/components';
import type { World } from '../core/world';
import type { RecentNarrativeItem } from './recentEventNarrativeStore';

export interface EntityHoverNarrative {
  title: string;
  lines: string[];
  hpBar: {
    current: number;
    max: number;
    ratio: number;
    label: string;
  } | null;
}

function round1(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '0.0';
}

function describeSocialIntention(world: World, movement: SocialNavMovement): string {
  switch (movement.intention) {
    case 'seekShelter':
      return world.weather.isRaining
        ? 'Heading for shelter.'
        : 'Heading for shelter.';
    case 'seekHome':
      return 'Returning home.';
    case 'approachForFeeling':
      return 'Approaching for introduction.';
    case 'approachMate':
      return 'Approaching a mate candidate.';
    case 'yield':
      return 'Yielding movement priority.';
    case 'avoid':
      return 'Avoiding a nearby threat.';
    case 'holdStill':
      return 'Holding position.';
    case 'roam':
    default:
      return 'Roaming.';
  }
}

function entityLabel(
  entityId: number,
  resolveEntityLabel?: (id: number) => string | null,
): string {
  const label = resolveEntityLabel?.(entityId);
  return label && label.trim().length > 0 ? label : `#${entityId}`;
}

function reasonClauses(
  world: World,
  entityId: number,
  resolveEntityLabel?: (id: number) => string | null,
): string[] {
  const clauses: string[] = [];
  const durability = world.durability.get(entityId);
  if (durability && durability.maxHp > 0) {
    const hpRatio = durability.hp / durability.maxHp;
    if (hpRatio < 0.5) {
      clauses.push('durability is low');
    }
  }

  const vision = world.visionHits.get(entityId);
  if (vision?.kind === 'entity') {
    const distanceText = vision.distance === null ? 'unknown range' : `${round1(vision.distance)} units`;
    clauses.push(`sees ${entityLabel(vision.hitId, resolveEntityLabel)} at ${distanceText}`);
  } else if (vision?.kind === 'boundary' && vision.boundarySide) {
    clauses.push(`sees the ${vision.boundarySide} boundary`);
  }

  const hearing = world.hearingHits.get(entityId);
  if (hearing) {
    clauses.push(
      `hears ${hearing.signature} from ${entityLabel(
        hearing.otherId,
        resolveEntityLabel,
      )} nearby`,
    );
  }

  const stillness = world.stillness.get(entityId);
  if (stillness) {
    clauses.push(`stillness is active for ${stillness.reason}`);
  }

  const feeling = world.feeling.get(entityId);
  if (feeling && feeling.partnerId !== null && feeling.state !== 'idle') {
    clauses.push(
      `feeling is ${feeling.state} with ${entityLabel(
        feeling.partnerId,
        resolveEntityLabel,
      )}`,
    );
  }

  return clauses;
}

function describeHouse(world: World, houseId: number): EntityHoverNarrative {
  const house = world.houses.get(houseId);
  const occupants = world.houseOccupants.get(houseId);
  const occupancy = occupants?.size ?? 0;
  return {
    title: `House #${houseId} (${house?.houseKind ?? 'House'})`,
    lines: [
      world.weather.isRaining
        ? `Occupancy ${occupancy}. Rain makes this shelter active.`
        : `Occupancy ${occupancy}.`,
      'East door for women, west door for men.',
    ],
    hpBar: null,
  };
}

export function buildEntityHoverNarrative(
  world: World,
  entityId: number,
  rankLabel: string,
  shapeLabel: string,
  displayName: string | null,
  history: RecentNarrativeItem[],
  resolveEntityLabel?: (id: number) => string | null,
): EntityHoverNarrative {
  const house = world.houses.get(entityId);
  if (house) {
    return describeHouse(world, entityId);
  }

  const movement = world.movements.get(entityId);
  const age = world.ages.get(entityId)?.ticksAlive ?? 0;
  const durability = world.durability.get(entityId) ?? null;
  const title = displayName ? `${displayName} · ${rankLabel}` : rankLabel;

  const lines: string[] = [];
  if (movement?.type === 'socialNav') {
    lines.push(describeSocialIntention(world, movement));
  } else if (movement?.type === 'randomWalk') {
    lines.push('is wandering with random walk dynamics.');
  } else if (movement?.type === 'straightDrift') {
    lines.push('is drifting linearly under current momentum.');
  } else if (movement?.type === 'seekPoint') {
    lines.push('is steering toward a fixed target point.');
  } else {
    lines.push('is currently stationary.');
  }

  const reasons = reasonClauses(world, entityId, resolveEntityLabel);
  if (reasons.length > 0) {
    lines.push(`Because it ${reasons[0]}.`);
  } else if (history.length > 0) {
    const latest = history[0];
    if (latest) {
      lines.push(`Recently: ${latest.text}`);
    }
  } else if (movement) {
    lines.push(`${shapeLabel}; age ${age}.`);
  }

  const hpBar =
    durability && durability.maxHp > 0
      ? {
          current: Math.max(0, durability.hp),
          max: durability.maxHp,
          ratio: Math.max(0, Math.min(1, durability.hp / durability.maxHp)),
          label: `HP ${round1(Math.max(0, durability.hp))} / ${round1(durability.maxHp)}`,
        }
      : null;

  return { title, lines: lines.slice(0, 2), hpBar };
}
