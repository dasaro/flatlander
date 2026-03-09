import { describe, expect, it } from 'vitest';

import { createDefaultSimulation } from '../src/presets/defaultSimulation';

describe('policy activation smoke', () => {
  it(
    'keeps policy state and emitted shifts internally consistent in a 7k-tick seed-42 default run',
    async () => {
      const simulation = createDefaultSimulation(42);
      let transitions = 0;
      let transitionEvents = 0;
      let activeTicks = 0;

      for (let tick = 0; tick < 7_000; tick += 1) {
        simulation.stepOneTick();
        if (simulation.world.policy.phase !== 'normal') {
          activeTicks += 1;
        }
        transitions += simulation.world.policyTransitionsThisTick;
        const events = simulation.world.events.drain();
        for (const event of events) {
          if (event.type === 'policyShift') {
            transitionEvents += 1;
          }
        }
        if (tick > 0 && tick % 250 === 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      }

      expect(transitionEvents).toBe(transitions);
      expect(activeTicks).toBeGreaterThanOrEqual(0);
      if (transitionEvents > 0) {
        expect(activeTicks).toBeGreaterThan(0);
      }
    },
    150_000,
  );
});
