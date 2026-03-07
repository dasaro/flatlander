import { describe, expect, it } from 'vitest';

import { createDefaultSimulation } from '../src/presets/defaultSimulation';

describe('policy activation smoke', () => {
  it(
    'activates at least one non-normal policy phase in a 6k-tick seed-42 default run',
    async () => {
      const simulation = createDefaultSimulation(42);
      let transitions = 0;
      let activeTicks = 0;

      for (let tick = 0; tick < 6_000; tick += 1) {
        simulation.stepOneTick();
        if (simulation.world.policy.phase !== 'normal') {
          activeTicks += 1;
        }
        transitions += simulation.world.policyTransitionsThisTick;
        simulation.world.events.drain();
        if (tick > 0 && tick % 250 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      expect(transitions).toBeGreaterThan(0);
      expect(activeTicks).toBeGreaterThan(0);
    },
    120_000,
  );
});
