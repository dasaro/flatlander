import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { SouthAttractionSystem } from '../src/systems/southAttractionSystem';

describe('south attraction escapability clamp', () => {
  it('keeps south drift dangerous but escapable for northbound propulsion', () => {
    const world = createWorld(807, {
      topology: 'bounded',
      southAttractionEnabled: true,
      southAttractionStrength: 6,
      southAttractionDrag: 8,
      southAttractionMaxTerminal: 6,
      southEscapeFraction: 0.5,
      southAttractionZoneStartFrac: 0.7,
      southAttractionZoneEndFrac: 0.95,
    });

    const id = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'randomWalk', speed: 18, turnRate: 0, boundary: 'bounce' },
      { x: 200, y: world.config.height - 5 },
    );

    const movement = world.movements.get(id);
    if (!movement || movement.type === 'straightDrift') {
      throw new Error('Expected heading-based movement in south escape test.');
    }
    movement.heading = -Math.PI / 2;

    const system = new SouthAttractionSystem();
    const dt = 1 / world.config.tickRate;
    for (let i = 0; i < 400; i += 1) {
      system.update(world, dt);
    }

    const driftVy = world.southDrifts.get(id)?.vy ?? 0;
    const netVy = Math.sin(movement.heading) * movement.speed + driftVy;
    expect(driftVy).toBeGreaterThan(0);
    expect(driftVy).toBeLessThanOrEqual(world.config.southEscapeFraction * movement.speed + 1e-9);
    expect(netVy).toBeLessThan(0);
  });
});
