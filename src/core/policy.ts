export type PolicyRegimePhase = 'normal' | 'agitation' | 'suppression' | 'cooldown';

export interface PolicyRegimeState {
  phase: PolicyRegimePhase;
  ticksRemaining: number;
  cycle: number;
  irregularShareBaseline: number | null;
  overcrowdingBaseline: number | null;
  triggerTicks: number;
  reason: string | null;
}

export function conceptionMultiplierForPolicy(phase: PolicyRegimePhase): number {
  switch (phase) {
    case 'agitation':
      return 0.88;
    case 'suppression':
      return 0.76;
    case 'cooldown':
      return 1.08;
    case 'normal':
    default:
      return 1;
  }
}

export function shelterUrgencyBoostForPolicy(phase: PolicyRegimePhase): number {
  switch (phase) {
    case 'agitation':
      return 1.15;
    case 'suppression':
      return 1.28;
    case 'cooldown':
      return 0.96;
    case 'normal':
    default:
      return 1;
  }
}

export function crowdStressMultiplierForPolicy(phase: PolicyRegimePhase): number {
  switch (phase) {
    case 'agitation':
      return 1.12;
    case 'suppression':
      return 1.26;
    case 'cooldown':
      return 0.92;
    case 'normal':
    default:
      return 1;
  }
}
