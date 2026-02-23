import type { SocialNavMovement } from '../components';
import type { RankComponent } from '../rank';
import { Rank, RankTag } from '../rank';
import type { ShapeComponent } from '../shapes';

function baseProfile(
  overrides: Partial<Pick<
    SocialNavMovement,
    'maxSpeed' | 'maxTurnRate' | 'decisionEveryTicks' | 'intentionMinTicks'
  >>,
): Pick<SocialNavMovement, 'maxSpeed' | 'maxTurnRate' | 'decisionEveryTicks' | 'intentionMinTicks'> {
  return {
    maxSpeed: overrides.maxSpeed ?? 18,
    maxTurnRate: overrides.maxTurnRate ?? 1.2,
    decisionEveryTicks: overrides.decisionEveryTicks ?? 16,
    intentionMinTicks: overrides.intentionMinTicks ?? 75,
  };
}

export function defaultSocialNavForRank(
  rank: RankComponent,
  shape: ShapeComponent,
): Pick<SocialNavMovement, 'maxSpeed' | 'maxTurnRate' | 'decisionEveryTicks' | 'intentionMinTicks'> {
  if (shape.kind === 'segment') {
    return baseProfile({
      maxSpeed: 14,
      maxTurnRate: 1.45,
      decisionEveryTicks: 18,
      intentionMinTicks: 90,
    });
  }

  if (rank.rank === Rank.Priest || rank.rank === Rank.NearCircle) {
    return baseProfile({
      maxSpeed: 8,
      maxTurnRate: 0.65,
      decisionEveryTicks: 24,
      intentionMinTicks: 120,
    });
  }

  if (rank.rank === Rank.Noble) {
    return baseProfile({
      maxSpeed: 11,
      maxTurnRate: 0.8,
      decisionEveryTicks: 22,
      intentionMinTicks: 110,
    });
  }

  if (rank.rank === Rank.Gentleman) {
    return baseProfile({
      maxSpeed: 13,
      maxTurnRate: 1,
      decisionEveryTicks: 20,
      intentionMinTicks: 95,
    });
  }

  if (rank.rank === Rank.Triangle) {
    if (rank.tags.includes(RankTag.Isosceles)) {
      return baseProfile({
        maxSpeed: 16,
        maxTurnRate: 1.3,
        decisionEveryTicks: 14,
        intentionMinTicks: 70,
      });
    }

    return baseProfile({
      maxSpeed: 14,
      maxTurnRate: 1.15,
      decisionEveryTicks: 17,
      intentionMinTicks: 85,
    });
  }

  if (rank.rank === Rank.Irregular) {
    return baseProfile({
      maxSpeed: 15,
      maxTurnRate: 1.25,
      decisionEveryTicks: 15,
      intentionMinTicks: 70,
    });
  }

  return baseProfile({});
}
