import { expect, it } from 'vitest';

import { createDefaultSimulation } from '../src/presets/defaultSimulation';
import { describeLong } from './longTest';

describeLong('mid-run smoke', () => {
  it(
    'shows rain-driven shelter usage in a short deterministic run (seed 42)',
    async () => {
      const simulation = createDefaultSimulation(42);
      const { world } = simulation;
      world.config.rainBasePeriodTicks = 600;
      world.config.rainPeriodTicks = 600;
      world.config.rainBaseDurationTicks = 220;
      world.config.rainDurationTicks = 220;

      let rainInsideTicks = 0;
      let rainInsideSum = 0;
      let dryInsideTicks = 0;
      let dryInsideSum = 0;
      let houseEnters = 0;
      let houseExits = 0;

      for (let tick = 0; tick < 4_000; tick += 1) {
        simulation.stepOneTick();
        if (world.weather.isRaining) {
          rainInsideTicks += 1;
          rainInsideSum += world.insideCountThisTick;
        } else {
          dryInsideTicks += 1;
          dryInsideSum += world.insideCountThisTick;
        }
        const events = world.events.drain();
        for (const event of events) {
          if (event.type === 'houseEnter') {
            houseEnters += 1;
          } else if (event.type === 'houseExit') {
            houseExits += 1;
          }
        }
        if (tick % 500 === 0) {
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        }
      }

      const rainMean = rainInsideTicks > 0 ? rainInsideSum / rainInsideTicks : 0;
      const dryMean = dryInsideTicks > 0 ? dryInsideSum / dryInsideTicks : 0;
      expect(houseEnters).toBeGreaterThan(0);
      expect(houseExits).toBeGreaterThan(0);
      expect(rainMean).toBeGreaterThan(dryMean);
    },
    60_000,
  );
});
