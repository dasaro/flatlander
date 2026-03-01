import { clamp } from '../geometry/vector';

export interface EntityVisualAlphaInput {
  ticksAlive: number;
  hp: number | null;
  maxHp: number | null;
  dimByAge: boolean;
  dimByDeterioration: boolean;
  strength: number;
  ageHalfLifeTicks: number;
}

export function ageAlphaFactor(ticksAlive: number, strength: number, ageHalfLifeTicks: number): number {
  const safeHalfLife = Math.max(1, ageHalfLifeTicks);
  const ageNorm = clamp(ticksAlive / safeHalfLife, 0, 1);
  return 1 - 0.4 * clamp(strength, 0, 1) * ageNorm;
}

export function durabilityAlphaFactor(hp: number, maxHp: number, strength: number): number {
  if (!Number.isFinite(hp) || !Number.isFinite(maxHp) || maxHp <= 0) {
    return 1;
  }

  const hpNorm = clamp(hp / maxHp, 0, 1);
  const floor = 1 - 0.7 * clamp(strength, 0, 1);
  return floor + (1 - floor) * hpNorm;
}

export function visualAlpha(input: EntityVisualAlphaInput): number {
  let alpha = 1;
  const strength = clamp(input.strength, 0, 1);

  if (input.dimByAge) {
    alpha *= ageAlphaFactor(Math.max(0, input.ticksAlive), strength, input.ageHalfLifeTicks);
  }

  if (input.dimByDeterioration && input.hp !== null && input.maxHp !== null) {
    alpha *= durabilityAlphaFactor(input.hp, input.maxHp, strength);
  }

  return clamp(alpha, 0.05, 1);
}

export function fogIntensityAtDistance(
  distance: number,
  fogDensity: number,
  fogMaxDistance: number,
): number {
  const d = clamp(distance, 0, Math.max(0, fogMaxDistance));
  if (fogDensity <= 0) {
    return 1;
  }
  return clamp(Math.exp(-fogDensity * d), 0, 1);
}

export function fogRingRadiusForLevel(level: number, fogDensity: number, fogMaxDistance: number): number | null {
  const clampedLevel = clamp(level, 1e-6, 0.999999);
  if (fogDensity <= 0) {
    return null;
  }

  const radius = -Math.log(clampedLevel) / fogDensity;
  if (!Number.isFinite(radius)) {
    return null;
  }
  return Math.min(radius, Math.max(0, fogMaxDistance));
}
