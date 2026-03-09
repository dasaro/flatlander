import { describe, expect, it } from 'vitest';

import type { SocialNavMovement } from '../src/core/components';
import { isEntityOutside } from '../src/core/housing/dwelling';
import { createDefaultSimulation } from '../src/presets/defaultSimulation';

describe('shelter seeking during rain', () => {
  it('drives a majority of outside social-nav entities toward shelter and produces house entries', () => {
    const simulation = createDefaultSimulation(42);
    const { world } = simulation;
    world.weather.isRaining = true;
    world.weather.ticksRemainingRain = 240;

    const trackedIds = [...world.entities].filter((id) => {
      const movement = world.movements.get(id);
      return movement?.type === 'socialNav' && isEntityOutside(world, id);
    });

    let peakShelterAdoption = 0;
    let houseEnters = 0;
    for (let tick = 0; tick < 240; tick += 1) {
      simulation.stepOneTick();
      let sheltering = 0;
      for (const id of trackedIds) {
        const movement = world.movements.get(id);
        const inside = !isEntityOutside(world, id);
        if (inside) {
          sheltering += 1;
          continue;
        }
        if (movement?.type !== 'socialNav') {
          continue;
        }
        const social = movement as SocialNavMovement;
        if (social.intention === 'seekShelter' || social.intention === 'seekHome') {
          sheltering += 1;
        }
      }
      peakShelterAdoption = Math.max(peakShelterAdoption, sheltering);
      for (const event of world.events.drain()) {
        if (event.type === 'houseEnter') {
          houseEnters += 1;
        }
      }
    }

    expect(trackedIds.length).toBeGreaterThan(0);
    expect(peakShelterAdoption / trackedIds.length).toBeGreaterThanOrEqual(0.7);
    expect(houseEnters).toBeGreaterThan(0);
  });
});
