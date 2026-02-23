import { Rank, RankTag, type RankComponent } from './rank';

export function initialIntelligenceForRank(rank: RankComponent): number {
  switch (rank.rank) {
    case Rank.Priest:
      return 0.95;
    case Rank.NearCircle:
      return 0.85;
    case Rank.Noble:
      return 0.72;
    case Rank.Gentleman:
      return 0.62;
    case Rank.Triangle:
      return rank.tags.includes(RankTag.Isosceles) ? 0.35 : 0.55;
    case Rank.Woman:
      return 0.2;
    case Rank.Irregular:
    default:
      return 0.25;
  }
}
