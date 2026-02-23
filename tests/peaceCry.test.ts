import { describe, expect, it } from 'vitest';

import { spawnEntity, spawnFromRequest } from '../src/core/factory';
import { createWorld } from '../src/core/world';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';

function collectPeaceCryLog(seed: number): number[][] {
  const world = createWorld(seed, {
    peaceCryEnabled: true,
    defaultPeaceCryCadenceTicks: 3,
    defaultPeaceCryRadius: 90,
  });

  spawnFromRequest(world, {
    shape: { kind: 'segment', size: 24 },
    movement: { type: 'straightDrift', vx: 12, vy: 0, boundary: 'wrap' },
    count: 2,
  });

  const peaceCrySystem = new PeaceCrySystem();
  const log: number[][] = [];
  const dt = 1 / world.config.tickRate;

  for (let i = 0; i < 12; i += 1) {
    world.tick += 1;
    peaceCrySystem.update(world, dt);
    log.push(world.audiblePings.map((ping) => ping.emitterId));
  }

  return log;
}

describe('peace-cry and hearing behavior', () => {
  it('emits peace-cry pings deterministically by tick cadence', () => {
    const a = collectPeaceCryLog(123);
    const b = collectPeaceCryLog(123);
    expect(a).toEqual(b);
    expect(a.some((tick) => tick.length > 0)).toBe(true);
  });

  it('does not emit pings for non-women entities', () => {
    const world = createWorld(71, {
      peaceCryEnabled: true,
      defaultPeaceCryCadenceTicks: 1,
      defaultPeaceCryRadius: 140,
    });

    spawnFromRequest(world, {
      shape: { kind: 'circle', size: 14 },
      movement: { type: 'straightDrift', vx: 10, vy: 0, boundary: 'wrap' },
      count: 1,
    });
    spawnFromRequest(world, {
      shape: { kind: 'polygon', sides: 5, size: 22, irregular: false },
      movement: { type: 'randomWalk', speed: 20, turnRate: 1.5, boundary: 'wrap' },
      count: 1,
    });

    const peaceCrySystem = new PeaceCrySystem();
    const dt = 1 / world.config.tickRate;
    let emitted = 0;

    for (let i = 0; i < 10; i += 1) {
      world.tick += 1;
      peaceCrySystem.update(world, dt);
      emitted += world.audiblePings.length;
    }

    expect(emitted).toBe(0);
  });

  it('amplifies women peace-cry cadence/radius in south zone', () => {
    const world = createWorld(91, {
      peaceCryEnabled: true,
      southStringencyEnabled: true,
      southStringencyMultiplier: 2,
      southAttractionZoneStartFrac: 0.75,
      southAttractionZoneEndFrac: 0.95,
    });

    const northWoman = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 10, vy: 0, boundary: 'wrap' },
      { x: 120, y: 100 },
    );
    const southWoman = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 10, vy: 0, boundary: 'wrap' },
      { x: 120, y: 690 },
    );

    const northCry = world.peaceCry.get(northWoman);
    const southCry = world.peaceCry.get(southWoman);
    if (!northCry || !southCry) {
      throw new Error('Missing peace-cry components in south stringency test.');
    }
    northCry.enabled = true;
    southCry.enabled = true;
    northCry.cadenceTicks = 10;
    southCry.cadenceTicks = 10;
    northCry.radius = 100;
    southCry.radius = 100;
    northCry.lastEmitTick = 0;
    southCry.lastEmitTick = 0;

    world.tick = 5;
    const system = new PeaceCrySystem();
    system.update(world, 1 / world.config.tickRate);

    const emitters = world.audiblePings.map((ping) => ping.emitterId);
    expect(emitters).toContain(southWoman);
    expect(emitters).not.toContain(northWoman);

    const southPing = world.audiblePings.find((ping) => ping.emitterId === southWoman);
    expect(southPing).toBeDefined();
    expect(southPing?.radius).toBeGreaterThan(150);
  });

  it('hearing-aware avoidance steers heading deterministically when inside radius', () => {
    const worldA = createWorld(9, {
      peaceCryEnabled: true,
      defaultPeaceCryCadenceTicks: 1,
      defaultPeaceCryRadius: 200,
    });
    const worldB = createWorld(9, {
      peaceCryEnabled: true,
      defaultPeaceCryCadenceTicks: 1,
      defaultPeaceCryRadius: 200,
    });

    const setupWorld = (world: ReturnType<typeof createWorld>) => {
      const emitterId = spawnEntity(
        world,
        { kind: 'segment', size: 30 },
        { type: 'straightDrift', vx: 8, vy: 0, boundary: 'wrap' },
        { x: 100, y: 140 },
      );
      const moverId = spawnEntity(
        world,
        { kind: 'polygon', sides: 5, size: 18, irregular: false },
        { type: 'randomWalk', speed: 18, turnRate: 1.2, boundary: 'wrap' },
        { x: 100, y: 100 },
      );

      const moverMovement = world.movements.get(moverId);
      if (!moverMovement || moverMovement.type === 'straightDrift') {
        throw new Error('Mover setup failed in peace-cry hearing test.');
      }
      moverMovement.heading = 0;

      const moverVision = world.vision.get(moverId);
      if (!moverVision) {
        throw new Error('Mover vision missing in peace-cry hearing test.');
      }
      moverVision.enabled = true;
      moverVision.avoidTurnRate = 2;

      const emitterCry = world.peaceCry.get(emitterId);
      if (!emitterCry) {
        throw new Error('Emitter peace-cry missing in hearing test.');
      }
      emitterCry.enabled = true;
      emitterCry.cadenceTicks = 1;
      emitterCry.radius = 200;
      emitterCry.lastEmitTick = 0;

      return { moverId };
    };

    const a = setupWorld(worldA);
    const b = setupWorld(worldB);

    const peaceCrySystem = new PeaceCrySystem();
    const avoidance = new AvoidanceSteeringSystem();
    const dt = 1 / worldA.config.tickRate;

    worldA.tick = 1;
    worldB.tick = 1;
    peaceCrySystem.update(worldA, dt);
    peaceCrySystem.update(worldB, dt);

    const beforeA = worldA.movements.get(a.moverId);
    const beforeB = worldB.movements.get(b.moverId);
    if (!beforeA || beforeA.type === 'straightDrift' || !beforeB || beforeB.type === 'straightDrift') {
      throw new Error('Missing mover movement in hearing avoidance test.');
    }
    const initialA = beforeA.heading;
    const initialB = beforeB.heading;

    avoidance.update(worldA, dt);
    avoidance.update(worldB, dt);

    const afterA = worldA.movements.get(a.moverId);
    const afterB = worldB.movements.get(b.moverId);
    if (!afterA || afterA.type === 'straightDrift' || !afterB || afterB.type === 'straightDrift') {
      throw new Error('Missing mover movement after hearing avoidance update.');
    }

    expect(afterA.heading).toBeLessThan(initialA);
    expect(afterA.heading).toBeCloseTo(afterB.heading, 8);
    expect(initialA).toBeCloseTo(initialB, 8);
  });
});
