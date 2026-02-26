import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { AgeDeteriorationSystem } from '../src/systems/ageDeteriorationSystem';

describe('AgeDeteriorationSystem', () => {
  it('reduces hp for old entities deterministically', () => {
    const world = createWorld(42, {
      ageWearEnabled: true,
      ageWearStartTicks: 0,
      ageWearRampTicks: 1,
      ageWearRate: 30,
      wearToHpStep: 1,
    });
    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 24, irregular: false },
      { type: 'randomWalk', speed: 0, turnRate: 0, boundary: 'wrap' },
      { x: 120, y: 140 },
    );
    const age = world.ages.get(id);
    const durability = world.durability.get(id);
    if (!age || !durability) {
      throw new Error('Expected spawned entity to have age and durability.');
    }
    age.ticksAlive = 9_000;
    const hpBefore = durability.hp;

    const system = new AgeDeteriorationSystem();
    for (let i = 0; i < 6; i += 1) {
      world.tick += 1;
      system.update(world, 1 / world.config.tickRate);
    }

    expect((world.durability.get(id)?.hp ?? hpBefore) < hpBefore).toBe(true);
  });

  it('does not apply wear before age threshold', () => {
    const world = createWorld(7, {
      ageWearEnabled: true,
      ageWearStartTicks: 10_000,
      ageWearRampTicks: 2_000,
      ageWearRate: 50,
      wearToHpStep: 1,
    });
    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 24, irregular: false },
      { type: 'randomWalk', speed: 0, turnRate: 0, boundary: 'wrap' },
      { x: 220, y: 180 },
    );
    const age = world.ages.get(id);
    const durability = world.durability.get(id);
    if (!age || !durability) {
      throw new Error('Expected spawned entity to have age and durability.');
    }
    age.ticksAlive = 2_000;
    const hpBefore = durability.hp;
    const wearBefore = durability.wear;

    const system = new AgeDeteriorationSystem();
    world.tick += 1;
    system.update(world, 1 / world.config.tickRate);

    const next = world.durability.get(id);
    expect(next?.hp ?? hpBefore).toBe(hpBefore);
    expect(next?.wear ?? wearBefore).toBe(wearBefore);
  });

  it('records attrition death when age wear depletes hp', () => {
    const world = createWorld(11, {
      ageWearEnabled: true,
      ageWearStartTicks: 0,
      ageWearRampTicks: 1,
      ageWearRate: 200,
      wearToHpStep: 0.5,
    });
    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 24, irregular: false },
      { type: 'randomWalk', speed: 0, turnRate: 0, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const age = world.ages.get(id);
    const durability = world.durability.get(id);
    if (!age || !durability) {
      throw new Error('Expected spawned entity to have age and durability.');
    }
    age.ticksAlive = 12_000;
    durability.hp = 1;
    durability.maxHp = 1;
    durability.wear = 0;

    const system = new AgeDeteriorationSystem();
    world.tick += 1;
    system.update(world, 1 / world.config.tickRate);

    expect(world.pendingDeaths.has(id)).toBe(true);
    expect(world.deathTypesThisTick.attrition).toBe(1);
    expect(world.deathTypesTotal.attrition).toBe(1);
    expect(world.events.drain().some((event) => event.type === 'death' && event.entityId === id)).toBe(true);
  });
});
