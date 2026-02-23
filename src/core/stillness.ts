import type { StillnessComponent, StillnessRequest } from './components';
import type { World } from './world';

export const STILLNESS_REASON_PRIORITY: Record<StillnessComponent['reason'], number> = {
  beingFelt: 5,
  feeling: 4,
  yieldToLady: 3,
  waitForBearing: 2,
  manual: 1,
};

function requestedByRank(requestedBy: number | null | undefined): number {
  return requestedBy ?? Number.MAX_SAFE_INTEGER;
}

function modeRank(mode: StillnessComponent['mode']): number {
  return mode === 'full' ? 1 : 0;
}

export function compareStillnessRequests(a: StillnessRequest, b: StillnessRequest): number {
  if (a.entityId !== b.entityId) {
    return a.entityId - b.entityId;
  }

  const priorityDelta =
    STILLNESS_REASON_PRIORITY[b.reason] - STILLNESS_REASON_PRIORITY[a.reason];
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const modeDelta = modeRank(b.mode) - modeRank(a.mode);
  if (modeDelta !== 0) {
    return modeDelta;
  }

  const requesterDelta = requestedByRank(a.requestedBy) - requestedByRank(b.requestedBy);
  if (requesterDelta !== 0) {
    return requesterDelta;
  }

  return 0;
}

export function isRequestHigherPriority(
  request: StillnessRequest,
  current: StillnessComponent,
): boolean {
  const requestPriority = STILLNESS_REASON_PRIORITY[request.reason];
  const currentPriority = STILLNESS_REASON_PRIORITY[current.reason];
  if (requestPriority !== currentPriority) {
    return requestPriority > currentPriority;
  }

  const requestModeRank = modeRank(request.mode);
  const currentModeRank = modeRank(current.mode);
  if (requestModeRank !== currentModeRank) {
    return requestModeRank > currentModeRank;
  }

  return requestedByRank(request.requestedBy) < requestedByRank(current.requestedBy);
}

export function requestStillness(world: World, request: StillnessRequest): void {
  if (!world.entities.has(request.entityId)) {
    return;
  }

  const ticksRemaining = Math.max(1, Math.round(request.ticksRemaining));
  world.stillnessRequests.push({
    ...request,
    ticksRemaining,
    requestedBy: request.requestedBy ?? null,
  });
}
