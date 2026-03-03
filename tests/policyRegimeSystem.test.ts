import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { PolicyRegimeSystem } from '../src/systems/policyRegimeSystem';

describe('PolicyRegimeSystem', () => {
  it('enters agitation when irregular share spikes and then cycles deterministically', () => {
    const world = createWorld(101, {
      policyRegimeEnabled: true,
      policyTriggerIrregularShare: 0.1,
      policyAgitationTicks: 1,
      policySuppressionTicks: 1,
      policyCooldownTicks: 1,
    });
    const system = new PolicyRegimeSystem();

    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, irregular: true, size: 14 },
      { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
      { x: 120, y: 120 },
    );
    const shape = world.shapes.get(id);
    if (!shape || shape.kind !== 'polygon') {
      throw new Error('Expected irregular polygon test subject.');
    }
    shape.irregular = true;

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

