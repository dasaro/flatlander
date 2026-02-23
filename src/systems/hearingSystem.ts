import { getEyeWorldPosition } from '../core/eye';
import { Rank } from '../core/rank';
import { getSortedEntityIds } from '../core/world';
import type { VoiceSignature } from '../core/components';
import type { World } from '../core/world';
import { normalize, sub } from '../geometry/vector';
import type { System } from './system';

interface HeardCandidate {
  otherId: number;
  signature: VoiceSignature;
  distance: number;
  direction: { x: number; y: number };
}

function emittedPeaceCrySet(world: World): Set<number> {
  return new Set(world.audiblePings.map((ping) => ping.emitterId));
}

function heardSignature(world: World, otherId: number, peaceCryEmitters: Set<number>): VoiceSignature | null {
  const rank = world.ranks.get(otherId);
  if (rank?.rank === Rank.Woman && peaceCryEmitters.has(otherId)) {
    return 'WomanCry';
  }

  const voice = world.voices.get(otherId);
  if (!voice) {
    return null;
  }

  if (voice.mimicryEnabled && voice.mimicrySignature) {
    return voice.mimicrySignature;
  }

  return voice.signature;
}

export class HearingSystem implements System {
  update(world: World, _dt: number): void {
    void _dt;
    world.hearingHits.clear();

    const ids = getSortedEntityIds(world);
    const peaceCryEmitters = emittedPeaceCrySet(world);

    for (const id of ids) {
      const perception = world.perceptions.get(id);
      const listenerTransform = world.transforms.get(id);
      if (!perception || !listenerTransform || perception.hearingSkill <= 0 || perception.hearingRadius <= 0) {
        continue;
      }

      const listenerEye = getEyeWorldPosition(world, id) ?? listenerTransform.position;
      let best: HeardCandidate | null = null;

      for (const otherId of ids) {
        if (otherId === id) {
          continue;
        }

        const otherTransform = world.transforms.get(otherId);
        if (!otherTransform) {
          continue;
        }

        const signature = heardSignature(world, otherId, peaceCryEmitters);
        if (!signature) {
          continue;
        }

        const otherEye = getEyeWorldPosition(world, otherId) ?? otherTransform.position;
        const toOther = sub(otherEye, listenerEye);
        const distance = Math.hypot(toOther.x, toOther.y);
        if (distance > perception.hearingRadius) {
          continue;
        }

        const candidate: HeardCandidate = {
          otherId,
          signature,
          distance,
          direction: normalize(toOther),
        };

        if (
          best === null ||
          candidate.distance < best.distance ||
          (candidate.distance === best.distance && candidate.otherId < best.otherId)
        ) {
          best = candidate;
        }
      }

      if (best) {
        world.hearingHits.set(id, best);
      }
    }
  }
}
