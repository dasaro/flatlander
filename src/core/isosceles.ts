import { clamp } from '../geometry/vector';

export const MIN_CANON_BRAIN_ANGLE_DEG = 0.5;
export const MAX_CANON_BRAIN_ANGLE_DEG = 60;
export const CANON_BRAIN_ANGLE_STEP_DEG = 0.5;
export const MIN_BRAIN_RATIO = 0.005;
export const MAX_BRAIN_RATIO = 0.95;

export function clampBrainAngleDeg(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) {
    return MIN_CANON_BRAIN_ANGLE_DEG;
  }
  return clamp(angleDeg, MIN_CANON_BRAIN_ANGLE_DEG, MAX_CANON_BRAIN_ANGLE_DEG);
}

export function brainAngleDegFromBaseRatio(baseRatio: number): number {
  const safeRatio = clamp(baseRatio, MIN_BRAIN_RATIO, MAX_BRAIN_RATIO);
  const halfBaseRatio = clamp(safeRatio / 2, 0, 1);
  const angleRad = 2 * Math.asin(halfBaseRatio);
  return (angleRad * 180) / Math.PI;
}

export function baseRatioFromBrainAngleDeg(angleDeg: number): number {
  const safeAngle = clampBrainAngleDeg(angleDeg);
  const angleRad = (safeAngle * Math.PI) / 180;
  const ratio = 2 * Math.sin(angleRad / 2);
  return clamp(ratio, MIN_BRAIN_RATIO, MAX_BRAIN_RATIO);
}

export function nextGenerationalBrainAngleDeg(parentAngleDeg: number): number {
  return clampBrainAngleDeg(parentAngleDeg + CANON_BRAIN_ANGLE_STEP_DEG);
}
