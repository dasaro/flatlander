import type { FemaleRank, FemaleStatusComponent, SwayComponent } from './components';

export function clampFemaleRank(value: string | null | undefined): FemaleRank {
  if (value === 'Low' || value === 'Middle' || value === 'High') {
    return value;
  }
  return 'Middle';
}

export function defaultFemaleStatus(): FemaleStatusComponent {
  return { femaleRank: 'Middle' };
}

export function swayProfileForFemaleRank(
  femaleRank: FemaleRank,
): Pick<SwayComponent, 'baseAmplitudeRad' | 'baseFrequencyHz'> {
  switch (femaleRank) {
    case 'Low':
      return {
        baseAmplitudeRad: 0.01,
        baseFrequencyHz: 0.6,
      };
    case 'High':
      return {
        baseAmplitudeRad: 0.14,
        baseFrequencyHz: 1.1,
      };
    case 'Middle':
    default:
      return {
        baseAmplitudeRad: 0.08,
        baseFrequencyHz: 0.9,
      };
  }
}

export function defaultSwayForFemaleRank(femaleRank: FemaleRank): SwayComponent {
  const profile = swayProfileForFemaleRank(femaleRank);
  return {
    enabled: true,
    baseAmplitudeRad: profile.baseAmplitudeRad,
    baseFrequencyHz: profile.baseFrequencyHz,
    phase: 0,
  };
}
