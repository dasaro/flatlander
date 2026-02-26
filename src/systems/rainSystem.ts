import type { World } from '../core/world';
import type { System } from './system';

function normalizePeriod(value: number): number {
  return Math.max(1, Math.round(value));
}

function jitteredTicks(world: World, baseTicks: number, jitterFrac: number): number {
  const base = normalizePeriod(baseTicks);
  const jitter = Math.max(0, Math.min(0.95, jitterFrac));
  if (jitter <= 0) {
    return base;
  }
  const offset = world.rng.nextRange(-jitter, jitter);
  return Math.max(1, Math.round(base * (1 + offset)));
}

// Flatland Part I §2: rain comes from the North at stated intervals; this
// deterministic weather cycle uses jittered intervals around stated baselines.
export class RainSystem implements System {
  update(world: World): void {
    const basePeriod = normalizePeriod(
      world.config.rainBasePeriodTicks > 0 ? world.config.rainBasePeriodTicks : world.config.rainPeriodTicks,
    );
    const baseDuration = normalizePeriod(
      world.config.rainBaseDurationTicks > 0 ? world.config.rainBaseDurationTicks : world.config.rainDurationTicks,
    );
    const periodJitter = Math.max(0, world.config.rainPeriodJitterFrac);
    const durationJitter = Math.max(0, world.config.rainDurationJitterFrac);

    if (!world.config.housesEnabled || world.houses.size === 0 || !world.config.rainEnabled) {
      world.weather.isRaining = false;
      world.weather.ticksUntilRain = basePeriod;
      world.weather.ticksRemainingRain = baseDuration;
      return;
    }

    if (world.weather.isRaining) {
      world.weather.ticksRemainingRain -= 1;
      if (world.weather.ticksRemainingRain <= 0) {
        world.weather.isRaining = false;
        world.weather.ticksUntilRain = jitteredTicks(world, basePeriod, periodJitter);
        world.weather.ticksRemainingRain = jitteredTicks(world, baseDuration, durationJitter);
      }
      return;
    }

    world.weather.ticksUntilRain -= 1;
    if (world.weather.ticksUntilRain <= 0) {
      world.weather.isRaining = true;
      world.weather.ticksRemainingRain = jitteredTicks(world, baseDuration, durationJitter);
      world.weather.ticksUntilRain = jitteredTicks(world, basePeriod, periodJitter);
    }
  }
}
