import { Rank } from './rank';
import type { PerceptionComponent } from './components';

export function defaultPerceptionForRank(rank: Rank): PerceptionComponent {
  switch (rank) {
    case Rank.Priest:
      return { sightSkill: 0.95, hearingSkill: 0.5, hearingRadius: 160 };
    case Rank.NearCircle:
      return { sightSkill: 0.85, hearingSkill: 0.54, hearingRadius: 170 };
    case Rank.Noble:
      return { sightSkill: 0.75, hearingSkill: 0.58, hearingRadius: 180 };
    case Rank.Gentleman:
      return { sightSkill: 0.6, hearingSkill: 0.65, hearingRadius: 190 };
    case Rank.Triangle:
      return { sightSkill: 0.35, hearingSkill: 0.72, hearingRadius: 205 };
    case Rank.Woman:
      return { sightSkill: 0.2, hearingSkill: 0.82, hearingRadius: 220 };
    case Rank.Irregular:
    default:
      return { sightSkill: 0.3, hearingSkill: 0.7, hearingRadius: 200 };
  }
}
