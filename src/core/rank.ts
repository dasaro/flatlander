import type { ShapeComponent } from './shapes';

export enum Rank {
  Woman = 'Woman',
  Priest = 'Priest',
  Irregular = 'Irregular',
  Triangle = 'Triangle',
  Gentleman = 'Gentleman',
  Noble = 'Noble',
  NearCircle = 'NearCircle',
}

export enum RankTag {
  Equilateral = 'Equilateral',
  Isosceles = 'Isosceles',
  Criminal = 'Criminal',
}

export interface RankComponent {
  rank: Rank;
  tags: RankTag[];
  nobleTier?: number;
}

export interface RankOptions {
  irregularityTolerance: number;
  nearCircleThreshold: number;
}

export function rankFromShape(shape: ShapeComponent, options: RankOptions): RankComponent {
  if (shape.kind === 'segment') {
    return { rank: Rank.Woman, tags: [] };
  }

  if (shape.kind === 'circle') {
    return { rank: Rank.Priest, tags: [] };
  }

  if (shape.sides === 3) {
    const tags: RankTag[] = [];
    if (shape.triangleKind === 'Isosceles') {
      tags.push(RankTag.Isosceles);
    } else {
      tags.push(RankTag.Equilateral);
    }
    return {
      rank: Rank.Triangle,
      tags,
    };
  }

  if (shape.irregularity > options.irregularityTolerance) {
    return { rank: Rank.Irregular, tags: [RankTag.Criminal] };
  }

  if (shape.sides === 4 || shape.sides === 5) {
    return {
      rank: Rank.Gentleman,
      tags: [],
    };
  }

  if (shape.sides >= 6 && shape.sides < options.nearCircleThreshold) {
    return {
      rank: Rank.Noble,
      tags: [],
      nobleTier: shape.sides,
    };
  }

  return {
    rank: Rank.NearCircle,
    tags: [],
  };
}
