import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { InspectionSystem } from '../src/systems/inspectionSystem';

function spawnIrregularPolygon(world: ReturnType<typeof createWorld>, x: number, y: number): number {
  const id = spawnEntity(
    world,
    { kind: 'polygon', sides: 5, irregular: true, size: 14 },
    { type: 'straightDrift', boundary: 'wrap', vx: 0, vy: 0 },
    { x, y },
  );
  const shape = world.shapes.get(id);
  if (!shape || shape.kind !== 'polygon') {
    throw new Error('Expected polygon shape in inspection test.');
  }
  shape.irregular = true;
  shape.regular = false;
  shape.irregularity = Math.max(shape.irregularity, 0.2);
  return id;
}

describe('InspectionSystem', () => {
  it('hospitalizes irregular polygons and emits deterministic hospitalization events', () => {
    const world = createWorld(202, {
      inspectionEnabled: true,
      inspectionCadenceTicks: 1,
      inspectionSampleSize: 1,
      inspectionHospitalizeDeviationDeg: 0.4,
      inspectionExecuteDeviationDeg: 9,
      inspectionHospitalizeTicks: 3,
      inspectionMaxExecutionsPerPass: 0,
    });
    const system = new InspectionSystem();
    const id = spawnIrregularPolygon(world, 180, 180);

    world.irregularity.set(id, {
      deviation: 0.3,
      angleDeviationDeg: 0.9,
    });

    system.update(world);
    expect(world.inspectionHospitalizedThisTick).toBe(1);
    const confinement = world.inspectionConfinement.get(id);
    expect(confinement?.ticksRemaining).toBe(3);

    const events = world.events.drain();
    const hospitalized = events.find((event) => event.type === 'inspectionHospitalized');
    expect(hospitalized).toBeDefined();
    if (!hospitalized || hospitalized.type !== 'inspectionHospitalized') {
      throw new Error('Expected inspectionHospitalized event.');
    }
    expect(hospitalized.entityId).toBe(id);
    expect(hospitalized.durationTicks).toBe(3);

    world.tick = 1;
    system.update(world);
    const request = world.stillnessRequests.find((entry) => entry.entityId === id);
    expect(request).toBeDefined();
    expect(request?.mode).toBe('full');
    expect(request?.reason).toBe('waitForBearing');
  });

  it('executes severe irregular cases in suppression phase and emits death+inspection events', () => {
    const world = createWorld(303, {
      inspectionEnabled: true,
      inspectionCadenceTicks: 1,
      inspectionSampleSize: 1,
      inspectionHospitalizeDeviationDeg: 0.2,
      inspectionExecuteDeviationDeg: 0.5,
      inspectionMaxExecutionsPerPass: 1,
    });
    const system = new InspectionSystem();
    const id = spawnIrregularPolygon(world, 220, 180);
    world.policy.phase = 'suppression';

    world.irregularity.set(id, {
      deviation: 0.45,
      angleDeviationDeg: 1.3,
    });

    system.update(world);
    expect(world.pendingDeaths.has(id)).toBe(true);
    expect(world.inspectionExecutedThisTick).toBe(1);

    const events = world.events.drain();
    const inspectionEvent = events.find((event) => event.type === 'inspectionExecuted');
    const deathEvent = events.find((event) => event.type === 'death');
    expect(inspectionEvent).toBeDefined();
    expect(deathEvent).toBeDefined();
    if (!inspectionEvent || inspectionEvent.type !== 'inspectionExecuted') {
      throw new Error('Expected inspectionExecuted event.');
    }
    expect(inspectionEvent.entityId).toBe(id);
    expect(inspectionEvent.deviationDeg).toBeGreaterThanOrEqual(1);
  });
});

