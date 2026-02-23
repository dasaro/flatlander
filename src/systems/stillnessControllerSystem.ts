import { isRequestHigherPriority, compareStillnessRequests } from '../core/stillness';
import type { StillnessRequest } from '../core/components';
import type { World } from '../core/world';
import type { System } from './system';

function requestToComponent(request: StillnessRequest) {
  return {
    mode: request.mode,
    reason: request.reason,
    ticksRemaining: Math.max(1, Math.round(request.ticksRemaining)),
    requestedBy: request.requestedBy ?? null,
  };
}

export class StillnessControllerSystem implements System {
  update(world: World): void {
    const stillIds = [...world.stillness.keys()].sort((a, b) => a - b);
    for (const id of stillIds) {
      const stillness = world.stillness.get(id);
      if (!stillness) {
        continue;
      }
      stillness.ticksRemaining -= 1;
      if (stillness.ticksRemaining <= 0 || !world.entities.has(id)) {
        world.stillness.delete(id);
      }
    }

    if (world.stillnessRequests.length === 0) {
      return;
    }

    const requests = world.stillnessRequests
      .filter((request) => request.ticksRemaining > 0 && world.entities.has(request.entityId))
      .sort(compareStillnessRequests);
    world.stillnessRequests.length = 0;

    const bestByEntity = new Map<number, StillnessRequest>();
    for (const request of requests) {
      const currentBest = bestByEntity.get(request.entityId);
      if (!currentBest) {
        bestByEntity.set(request.entityId, request);
        continue;
      }

      const preferred = compareStillnessRequests(request, currentBest) < 0;
      if (preferred) {
        bestByEntity.set(request.entityId, request);
      } else if (
        compareStillnessRequests(request, currentBest) === 0 &&
        request.ticksRemaining > currentBest.ticksRemaining
      ) {
        bestByEntity.set(request.entityId, request);
      }
    }

    const entityIds = [...bestByEntity.keys()].sort((a, b) => a - b);
    for (const entityId of entityIds) {
      const request = bestByEntity.get(entityId);
      if (!request) {
        continue;
      }

      const existing = world.stillness.get(entityId);
      if (!existing) {
        world.stillness.set(entityId, requestToComponent(request));
        continue;
      }

      if (isRequestHigherPriority(request, existing)) {
        world.stillness.set(entityId, requestToComponent(request));
        continue;
      }

      if (
        request.reason === existing.reason &&
        request.mode === existing.mode &&
        (request.requestedBy ?? null) === (existing.requestedBy ?? null)
      ) {
        existing.ticksRemaining = Math.max(existing.ticksRemaining, request.ticksRemaining);
      }
    }
  }
}
