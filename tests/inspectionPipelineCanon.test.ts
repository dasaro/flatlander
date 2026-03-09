import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { InspectionSystem } from '../src/systems/inspectionSystem';
import { RegularizationSystem } from '../src/systems/regularizationSystem';

function spawnIrregularPolygon(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const id = spawnEntity(
    world,
    { kind: 'polygon', sides: 5, irregular: true, size: 14 },
    { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
    { x, y },
  );
  const shape = world.shapes.get(id);
  if (!shape || shape.kind !== 'polygon') {
    throw new Error('Expected irregular polygon.');
  }
  shape.irregular = true;
  shape.regular = false;
  return id;
}

describe('inspection canon pipeline', () => {
  it('hospitalizes curable irregulars and allows later regularization', () => {
    const world = createWorld(202, {
      inspectionEnabled: true,
      inspectionCadenceTicks: 1,
      inspectionSampleSize: 1,
      inspectionHospitalizeDeviationDeg: 0.4,
      inspectionExecuteDeviationDeg: 9,
      inspectionHospitalizeTicks: 3,
      inspectionMaxExecutionsPerPass: 0,
      regularizationEnabled: true,
      regularizationRate: 0.6,
      regularityTolerance: 0.02,
    });
    const inspection = new InspectionSystem();
    const regularization = new RegularizationSystem();
    const id = spawnIrregularPolygon(world, 180, 180);
    const age = world.ages.get(id);
    const intelligence = world.intelligence.get(id);
    if (!age || !intelligence) {
      throw new Error('Missing components in curable irregular test.');
    }
    age.ticksAlive = 120;
    intelligence.value = 1;
    world.irregularity.set(id, {
      deviation: 0.22,
      angleDeviationDeg: 0.9,
    });

    inspection.update(world);
    const hospitalized = world.events.drain().find((event) => event.type === 'inspectionHospitalized');
    expect(hospitalized).toBeDefined();
    expect(world.inspectionConfinement.has(id)).toBe(true);

    let regularized = false;
    for (let i = 0; i < 120; i += 1) {
      world.tick += 1;
      regularization.update(world, 1 / world.config.tickRate);
      const events = world.events.drain();
      if (events.some((event) => event.type === 'regularized' && event.entityId === id)) {
        regularized = true;
        break;
      }
    }
    expect(regularized).toBe(true);
    expect(world.irregularity.has(id)).toBe(false);
  });

  it('executes severe mature irregulars and emits both inspection and death events', () => {
    const world = createWorld(303, {
      inspectionEnabled: true,
      inspectionCadenceTicks: 1,
      inspectionSampleSize: 1,
      inspectionHospitalizeDeviationDeg: 0.2,
      inspectionExecuteDeviationDeg: 0.5,
      inspectionMaxExecutionsPerPass: 1,
    });
    const inspection = new InspectionSystem();
    const id = spawnIrregularPolygon(world, 220, 180);
    world.policy.phase = 'suppression';
    const age = world.ages.get(id);
    if (!age) {
      throw new Error('Missing age in severe irregular test.');
    }
    age.ticksAlive = world.config.irregularFrameSetTicks + 1;
    world.irregularity.set(id, {
      deviation: 0.45,
      angleDeviationDeg: 1.3,
    });

    inspection.update(world);
    const events = world.events.drain();
    expect(events.some((event) => event.type === 'inspectionExecuted' && event.entityId === id)).toBe(true);
    expect(events.some((event) => event.type === 'death' && event.entityId === id)).toBe(true);
  });
});
