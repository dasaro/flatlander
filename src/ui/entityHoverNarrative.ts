import type { MovementComponent, SocialNavMovement } from '../core/components';
import type { World } from '../core/world';
import type { RecentNarrativeItem } from './recentEventNarrativeStore';

export interface EntityHoverNarrative {
  title: string;
  lines: string[];
}

function round1(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : '0.0';
}

function movementSpeed(movement: MovementComponent | undefined): number {
  if (!movement) {
    return 0;
  }
  if (movement.type === 'straightDrift') {
    return Math.hypot(movement.vx, movement.vy);
  }
  return movement.speed;
}

function describeSocialIntention(world: World, movement: SocialNavMovement): string {
  switch (movement.intention) {
    case 'seekShelter':
      return world.weather.isRaining
        ? 'is heading for shelter because rain is active.'
        : 'is heading for shelter due to risk/pressure signals.';
    case 'seekHome':
      return 'is returning to home shelter to regroup.';
    case 'approachForFeeling':
      return 'is approaching for a tactile introduction.';
    case 'approachMate':
      return 'is approaching a mate candidate.';
    case 'yield':
      return 'is yielding movement priority to nearby traffic.';
    case 'avoid':
      return 'is actively avoiding a nearby threat.';
    case 'holdStill':
      return 'is intentionally holding position.';
    case 'roam':
    default:
      return 'is roaming while monitoring local conditions.';
  }
}

function reasonClauses(world: World, entityId: number): string[] {
  const clauses: string[] = [];
  const durability = world.durability.get(entityId);
  if (durability && durability.maxHp > 0) {
    const hpRatio = durability.hp / durability.maxHp;
    if (hpRatio < 0.5) {
      clauses.push(`durability is low (${round1(durability.hp)}/${round1(durability.maxHp)} HP)`);
    }
  }

  const vision = world.visionHits.get(entityId);
  if (vision?.kind === 'entity') {
    const distanceText = vision.distance === null ? 'unknown range' : `${round1(vision.distance)} units`;
    clauses.push(`it sees #${vision.hitId} at ${distanceText}`);
  } else if (vision?.kind === 'boundary' && vision.boundarySide) {
    clauses.push(`it sees the ${vision.boundarySide} boundary`);
  }

  const hearing = world.hearingHits.get(entityId);
  if (hearing) {
    clauses.push(`it hears ${hearing.signature} nearby`);
  }

  const stillness = world.stillness.get(entityId);
  if (stillness) {
    clauses.push(`stillness is active (${stillness.reason}, ${stillness.ticksRemaining} ticks left)`);
  }

  const feeling = world.feeling.get(entityId);
  if (feeling && feeling.partnerId !== null && feeling.state !== 'idle') {
    clauses.push(`feeling protocol is ${feeling.state} with #${feeling.partnerId}`);
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
        ? `Rain is active; occupancy is ${occupancy} and this shelter is currently strategic.`
        : `Dry phase; occupancy is ${occupancy}.`,
      `Door policy: east entry for women, west entry for men.`,
    ],
  };
}

export function buildEntityHoverNarrative(
  world: World,
  entityId: number,
  rankLabel: string,
  shapeLabel: string,
  displayName: string | null,
  history: RecentNarrativeItem[],
): EntityHoverNarrative {
  const house = world.houses.get(entityId);
  if (house) {
    return describeHouse(world, entityId);
  }

  const movement = world.movements.get(entityId);
  const age = world.ages.get(entityId)?.ticksAlive ?? 0;
  const kills = world.combatStats.get(entityId)?.kills ?? 0;
  const job = world.jobs.get(entityId)?.job ?? null;
  const speed = movementSpeed(movement);
  const title = displayName ? `${displayName} · ${rankLabel} (#${entityId})` : `${rankLabel} (#${entityId})`;

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

  const reasons = reasonClauses(world, entityId);
  if (reasons.length > 0) {
    lines.push(`Why: ${reasons.slice(0, 2).join('; ')}.`);
  }

  lines.push(
    `${shapeLabel}; speed ${round1(speed)}; age ${age}; kills ${kills}${job ? `; job ${job}` : ''}.`,
  );

  if (history.length > 0) {
    const recent = history
      .slice(0, 2)
      .map((item) => `t${item.tick}: ${item.text}`)
      .join(' ');
    lines.push(`Recent: ${recent}`);
  }

  return { title, lines: lines.slice(0, 4) };
}
