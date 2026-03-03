export interface SightVisibilityContext {
  hasDimnessCue: boolean;
  sightSkill: number;
  fogMinIntensity: number;
}

export function effectiveSightSignal(intensity: number, context: SightVisibilityContext): number {
  const clampedIntensity = Math.max(0, Math.min(1, intensity));
  const clampedSkill = Math.max(0, Math.min(1, context.sightSkill));
  return context.hasDimnessCue ? clampedIntensity * clampedSkill : clampedSkill;
}

export function sampleVisibleToSight(intensity: number, context: SightVisibilityContext): boolean {
  return effectiveSightSignal(intensity, context) >= Math.max(0, context.fogMinIntensity);
}
