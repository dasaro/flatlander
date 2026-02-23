import type { KnownInfo } from '../core/components';
import type { Vec2 } from '../geometry/vector';

export interface KnownCandidate {
  id: number;
  learnedAtTick: number;
  distance: number;
}

export function selectTopKnownIds(
  known: Map<number, KnownInfo>,
  positions: Map<number, Vec2>,
  selectedPosition: Vec2,
  maxKnownEdges: number,
  focusRadius: number,
): number[] {
  const limit = Math.max(0, Math.round(maxKnownEdges));
  if (limit === 0) {
    return [];
  }

  const radius = Math.max(0, focusRadius);
  const candidates: KnownCandidate[] = [];

  for (const [id, info] of known) {
    const position = positions.get(id);
    if (!position) {
      continue;
    }

    const distance = Math.hypot(position.x - selectedPosition.x, position.y - selectedPosition.y);
    if (radius > 0 && distance > radius) {
      continue;
    }

    candidates.push({
      id,
      learnedAtTick: Number.isFinite(info.learnedAtTick) ? info.learnedAtTick : Number.NEGATIVE_INFINITY,
      distance,
    });
  }

  candidates.sort((left, right) => {
    if (left.learnedAtTick !== right.learnedAtTick) {
      return right.learnedAtTick - left.learnedAtTick;
    }
    if (left.distance !== right.distance) {
      return left.distance - right.distance;
    }
    return left.id - right.id;
  });

  return candidates.slice(0, limit).map((candidate) => candidate.id);
}
