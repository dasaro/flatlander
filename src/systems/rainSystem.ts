import type { World } from '../core/world';
import type { System } from './system';

function normalizePeriod(value: number): number {
  return Math.max(1, Math.round(value));
}

// Flatland Part I §2: rain comes from the North at stated intervals; this
// deterministic weather cycle drives shelter-seeking behavior without RNG.
export class RainSystem implements System {
  update(world: World): void {
    const period = normalizePeriod(world.config.rainPeriodTicks);
    const duration = normalizePeriod(world.config.rainDurationTicks);

    if (!world.config.housesEnabled || world.houses.size === 0 || !world.config.rainEnabled) {
      world.weather.isRaining = false;
      world.weather.ticksUntilRain = period;
      world.weather.ticksRemainingRain = duration;
      return;
    }

    if (world.weather.isRaining) {
      world.weather.ticksRemainingRain -= 1;
      if (world.weather.ticksRemainingRain <= 0) {
        world.weather.isRaining = false;
        world.weather.ticksUntilRain = period;
        world.weather.ticksRemainingRain = duration;
      }
      return;
    }

    world.weather.ticksUntilRain -= 1;
    if (world.weather.ticksUntilRain <= 0) {
      world.weather.isRaining = true;
      world.weather.ticksRemainingRain = duration;
      world.weather.ticksUntilRain = period;
    }
  }
}
