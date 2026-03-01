import { describe, expect, it } from 'vitest';

import { createDefaultWorld } from '../src/presets/defaultScenario';
import { SocialNavMindSystem } from '../src/systems/socialNavMindSystem';
import { VisionSystem } from '../src/systems/visionSystem';
import type { SocialNavMovement } from '../src/core/components';
import { isEntityOutside } from '../src/core/housing/dwelling';

describe('rain shelter adoption', () => {
  it('drives most outside social-nav entities to seek shelter/home during rain', () => {
    const world = createDefaultWorld(42);
    world.weather.isRaining = true;

    let totalOutsideSocialNav = 0;
    for (const id of world.entities) {
      const movement = world.movements.get(id);
      if (!movement || movement.type !== 'socialNav') {
        continue;
      }
      if (!isEntityOutside(world, id)) {
        continue;
      }
      totalOutsideSocialNav += 1;
      const social = movement as SocialNavMovement;
      social.intention = 'roam';
      social.intentionTicksLeft = 0;
      social.goal = {
        type: 'direction',
        heading: social.heading,
      };
    }

    new VisionSystem().update(world);
    new SocialNavMindSystem().update(world);

    let seeking = 0;
    for (const id of world.entities) {
      const movement = world.movements.get(id);
      if (!movement || movement.type !== 'socialNav') {
        continue;
      }
      if (!isEntityOutside(world, id)) {
        continue;
      }
      if (movement.intention === 'seekShelter' || movement.intention === 'seekHome') {
        seeking += 1;
      }
    }

    expect(totalOutsideSocialNav).toBeGreaterThan(0);
    expect(seeking / totalOutsideSocialNav).toBeGreaterThanOrEqual(0.7);
  });
});
