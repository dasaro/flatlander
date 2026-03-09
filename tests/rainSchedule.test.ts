import { describe, expect, it } from 'vitest';

import { createHouseLayout, houseComponentFromLayout, houseShapeFromLayout } from '../src/core/housing/houseFactory';
import { createWorld } from '../src/core/world';
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

function collectRainTransitions(
  seed: number,
  period: number,
  duration: number,
  periodJitter: number,
  durationJitter: number,
  ticks: number,
): { starts: number[]; ends: number[] } {
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
  const ends: number[] = [];
  let wasRaining = world.weather.isRaining;

  for (let tick = 0; tick < ticks; tick += 1) {
    system.update(world);
    if (!wasRaining && world.weather.isRaining) {
      starts.push(tick + 1);
    }
    if (wasRaining && !world.weather.isRaining) {
      ends.push(tick + 1);
    }
    wasRaining = world.weather.isRaining;
    world.tick += 1;
  }

  return { starts, ends };
}

describe('canon rain schedule', () => {
  it('is deterministic for the same seed and bounded by configured jitter', () => {
    const config = {
      period: 28,
      duration: 9,
      periodJitter: 0.25,
      durationJitter: 0.2,
      ticks: 400,
    };
    const a = collectRainTransitions(
      42,
      config.period,
      config.duration,
      config.periodJitter,
      config.durationJitter,
      config.ticks,
    );
    const b = collectRainTransitions(
      42,
      config.period,
      config.duration,
      config.periodJitter,
      config.durationJitter,
      config.ticks,
    );

    expect(a).toEqual(b);
    expect(a.starts.length).toBeGreaterThan(2);
    expect(a.ends.length).toBeGreaterThan(2);

    const intervalMin = Math.round(config.period * (1 - config.periodJitter)) +
      Math.round(config.duration * (1 - config.durationJitter));
    const intervalMax = Math.round(config.period * (1 + config.periodJitter)) +
      Math.round(config.duration * (1 + config.durationJitter));

    const intervals = a.starts.slice(1).map((start, index) => start - a.starts[index]!);
    for (const interval of intervals) {
      expect(interval).toBeGreaterThanOrEqual(intervalMin - 2);
      expect(interval).toBeLessThanOrEqual(intervalMax + 2);
    }
  });

  it('keeps rain transitions entirely out of the event queue when weather is modeled as state', () => {
    const world = createWorld(77, {
      housesEnabled: true,
      rainEnabled: true,
      rainBasePeriodTicks: 10,
      rainBaseDurationTicks: 4,
      rainPeriodJitterFrac: 0,
      rainDurationJitterFrac: 0,
    });
    addHouse(world, 300, 250);
    const system = new RainSystem();

    for (let tick = 0; tick < 40; tick += 1) {
      system.update(world);
      const events = world.events.drain();
      expect(events.some((event) => event.type === 'peaceCry')).toBe(false);
      expect(events.some((event) => event.type === 'policyShift')).toBe(false);
      world.tick += 1;
    }
  });
});
