import { clamp } from '../geometry/vector';
import { initialIntelligenceForRank } from '../core/intelligence';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

export class IntelligenceGrowthSystem implements System {
  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);
    const baseGrowth = Math.max(0, world.config.intelligenceGrowthPerSecond) * dt;
    const handshakeBonus = Math.max(0, world.config.handshakeIntelligenceBonus);

    for (const id of ids) {
      if (world.staticObstacles.has(id)) {
        continue;
      }

      const rank = world.ranks.get(id);
      if (!rank) {
        continue;
      }

      let intelligence = world.intelligence.get(id);
      if (!intelligence) {
        intelligence = {
          value: initialIntelligenceForRank(rank),
        };
        world.intelligence.set(id, intelligence);
      }

      const handshakes = world.handshakeCounts.get(id) ?? 0;
      const growth = baseGrowth + handshakeBonus * handshakes;
      intelligence.value = clamp(intelligence.value + growth, 0, 1);
    }

    world.handshakeCounts.clear();
  }
}
