import { describe, expect, it } from 'vitest';

import { createWorld } from '../src/core/world';
import {
  createHouseLayout,
  houseComponentFromLayout,
  houseShapeFromLayout,
} from '../src/core/housing/houseFactory';
import { RainSystem } from '../src/systems/rainSystem';

function addHouse(world: ReturnType<typeof createWorld>, x: number, y: number): void {
  const layout = createHouseLayout('Pentagon', 30);
  const id = world.nextEntityId;
  world.nextEntityId += 1;
  world.entities.add(id);
  world.transforms.set(id, { position: { x, y }, rotation: 0 });
  world.shapes.set(id, houseShapeFromLayout(layout));
  world.staticObstacles.set(id, { kind: 'house' });
  world.houses.set(id, houseComponentFromLayout('Pentagon', layout, null));
  world.houseOccupants.set(id, new Set());
}

function collectRainStarts(
  seed: number,
  period: number,
  duration: number,
  periodJitter: number,
  durationJitter: number,
  ticks: number,
): number[] {
  const world = createWorld(seed, {
    housesEnabled: true,
    rainEnabled: true,
    rainBasePeriodTicks: period,
    rainBaseDurationTicks: duration,
    rainPeriodJitterFrac: periodJitter,
    rainDurationJitterFrac: durationJitter,
  });
  addHouse(world, 300, 250);
  const system = new RainSystem();
  const starts: number[] = [];
  let wasRaining = world.weather.isRaining;
  for (let tick = 0; tick < ticks; tick += 1) {
    system.update(world);
    if (!wasRaining && world.weather.isRaining) {
      starts.push(tick + 1);
    }
    wasRaining = world.weather.isRaining;
    world.tick += 1;
  }
  return starts;
}

describe('rain system jitter', () => {
  it('produces deterministic rain starts for the same seed/config', () => {
    const startsA = collectRainStarts(42, 20, 8, 0.3, 0.2, 300);
    const startsB = collectRainStarts(42, 20, 8, 0.3, 0.2, 300);
    expect(startsA).toEqual(startsB);
  });

  it('keeps fixed intervals when jitter is disabled', () => {
    const starts = collectRainStarts(77, 24, 6, 0, 0, 300);
    const intervals = starts.slice(1).map((start, index) => start - starts[index]!);
    expect(intervals.length).toBeGreaterThan(2);
    for (const interval of intervals) {
      expect(interval).toBe(24 + 6);
    }
  });

  it('varies intervals when jitter is enabled', () => {
    const starts = collectRainStarts(77, 24, 6, 0.35, 0.2, 300);
    const intervals = starts.slice(1).map((start, index) => start - starts[index]!);
    expect(intervals.length).toBeGreaterThan(2);
    const unique = new Set(intervals);
    expect(unique.size).toBeGreaterThan(1);
  });
});
