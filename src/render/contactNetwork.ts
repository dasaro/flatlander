import type { KnownInfo } from '../core/components';
import type { Vec2 } from '../geometry/vector';

export interface KnownCandidate {
  id: number;
  learnedAtTick: number;
  distance: number;
}

export function contactCurveControlPoint(
  from: Vec2,
  to: Vec2,
  sourceId: number,
  targetId: number,
): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    return { x: from.x, y: from.y };
  }

  const normalX = -dy / length;
  const normalY = dx / length;
  const minId = Math.min(sourceId, targetId);
  const maxId = Math.max(sourceId, targetId);
  const paritySign = ((minId * 31 + maxId * 17) & 1) === 0 ? 1 : -1;
  const sourceSign = sourceId <= targetId ? 1 : -1;
  const bendSign = paritySign * sourceSign;
  const offset = Math.max(12, Math.min(64, length * 0.22));
  const midX = from.x + dx * 0.5;
  const midY = from.y + dy * 0.5;

  return {
    x: midX + normalX * offset * bendSign,
    y: midY + normalY * offset * bendSign,
  };
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
