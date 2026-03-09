import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { CivicOrderSystem } from '../src/systems/civicOrderSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';
import { StillnessControllerSystem } from '../src/systems/stillnessControllerSystem';

describe('cry compliance halt track', () => {
  it('emits a compliance halt when a moving segment disables the public cry channel', () => {
    const world = createWorld(991, {
      peaceCryEnabled: true,
      strictPeaceCryComplianceEnabled: true,
      peaceCryComplianceStillnessTicks: 3,
    });

    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 26 },
      { type: 'randomWalk', speed: 14, turnRate: 1.2, boundary: 'wrap' },
      { x: 120, y: 120 },
    );
    const cry = world.peaceCry.get(womanId);
    if (!cry) {
      throw new Error('Missing peace-cry component.');
    }
    cry.enabled = false;

    world.tick = 1;
    new PeaceCrySystem().update(world, 1 / world.config.tickRate);
    new StillnessControllerSystem().update(world);
    new MovementSystem().update(world, 1 / world.config.tickRate);

    const haltEvent = world.events.drain().find((event) => event.type === 'peaceCryComplianceHalt');
    expect(haltEvent).toBeDefined();
    if (!haltEvent || haltEvent.type !== 'peaceCryComplianceHalt') {
      throw new Error('Expected cry compliance halt event.');
    }
    expect(haltEvent.entityId).toBe(womanId);
    expect(haltEvent.reason).toBe('CryCompliance');
    expect(world.stillness.get(womanId)?.ticksRemaining).toBeGreaterThan(0);
  });

  it('uses the same track for rain-curfew halts but distinguishes the reason in payloads', () => {
    const world = createWorld(992, {
      housesEnabled: false,
      rainEnabled: true,
      rainCurfewEnabled: true,
      rainCurfewOutsideGraceTicks: 1,
    });
    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 10, maxTurnRate: 1, decisionEveryTicks: 4, intentionMinTicks: 12 },
      { x: 220, y: 220 },
    );
    world.weather.isRaining = true;
    world.tick = 1;

    new CivicOrderSystem().update(world);

    const haltEvent = world.events.drain().find((event) => event.type === 'peaceCryComplianceHalt');
    expect(haltEvent).toBeDefined();
    if (!haltEvent || haltEvent.type !== 'peaceCryComplianceHalt') {
      throw new Error('Expected rain-curfew compliance halt event.');
    }
    expect(haltEvent.entityId).toBe(womanId);
    expect(haltEvent.reason).toBe('RainCurfew');
  });
});
