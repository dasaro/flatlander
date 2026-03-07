import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { PolicyRegimeSystem } from '../src/systems/policyRegimeSystem';

describe('PolicyRegimeSystem', () => {
  it('does not trigger immediately from baseline irregular composition', () => {
    const world = createWorld(101, {
      policyRegimeEnabled: true,
      policyTriggerIrregularShare: 1,
      policyTriggerIrregularDelta: 0.03,
      policyTriggerPersistenceTicks: 1,
      policyWarmupTicks: 10,
    });
    const system = new PolicyRegimeSystem();

    spawnEntity(
      world,
      { kind: 'polygon', sides: 5, irregular: true, size: 14 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 120, y: 120 },
    );

    system.update(world);

    expect(world.policy.phase).toBe('normal');
    expect(world.policyTransitionsThisTick).toBe(0);
  });

  it('enters agitation when irregular share spikes above baseline and then cycles deterministically', () => {
    const world = createWorld(101, {
      policyRegimeEnabled: true,
      policyTriggerIrregularShare: 1,
      policyTriggerIrregularDelta: 0.01,
      policyTriggerPersistenceTicks: 1,
      policyWarmupTicks: 0,
      policyAgitationTicks: 1,
      policySuppressionTicks: 1,
      policyCooldownTicks: 1,
    });
    const system = new PolicyRegimeSystem();

    for (let i = 0; i < 4; i += 1) {
      spawnEntity(
        world,
        { kind: 'polygon', sides: 5, irregular: false, size: 14 },
        { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
        { x: 120 + i * 10, y: 120 },
      );
    }
    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, irregular: true, size: 14 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 180, y: 120 },
    );
    const shape = world.shapes.get(id);
    if (!shape || shape.kind !== 'polygon') {
      throw new Error('Expected irregular polygon test subject.');
    }
    shape.irregular = true;

    world.tick = 1;
    system.update(world); // establish baseline
    expect(world.policy.phase).toBe('normal');

    for (let i = 0; i < 2; i += 1) {
      const id2 = spawnEntity(
        world,
        { kind: 'polygon', sides: 5, irregular: true, size: 14 },
        { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
        { x: 200 + i * 10, y: 120 },
      );
      const shape2 = world.shapes.get(id2);
      if (!shape2 || shape2.kind !== 'polygon') {
        throw new Error('Expected second irregular polygon test subject.');
      }
      shape2.irregular = true;
    }

    world.policyTransitionsThisTick = 0;
    system.update(world); // normal -> agitation
    expect(world.policy.phase).toBe('agitation');
    expect(world.policy.cycle).toBe(1);
    expect(world.policyTransitionsThisTick).toBe(1);

    system.update(world); // agitation -> suppression
    expect(world.policy.phase).toBe('suppression');
    system.update(world); // suppression -> cooldown
    expect(world.policy.phase).toBe('cooldown');

    shape.irregular = false;
    system.update(world); // cooldown -> normal
    expect(world.policy.phase).toBe('normal');

    const shifts = world.events
      .drain()
      .filter((event) => event.type === 'policyShift')
      .map((event) => `${event.phase}:${event.reason}`);
    expect(shifts).toEqual([
      'agitation:IrregularitySpike',
      'suppression:SuppressionOrder',
      'cooldown:Deescalation',
      'normal:StabilityRestored',
    ]);
  });
});
