import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { FeelingApproachSystem } from '../src/systems/feelingApproachSystem';
import { FeelingSystem } from '../src/systems/feelingSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';
import { SouthAttractionSystem } from '../src/systems/southAttractionSystem';
import { VisionSystem } from '../src/systems/visionSystem';

function runCollisionAndFeeling(worldSeed = 1) {
  const world = createWorld(worldSeed);
  const collision = new CollisionSystem();
  const feeling = new FeelingSystem();

  return {
    world,
    step: () => {
      collision.update(world);
      feeling.update(world, 1 / world.config.tickRate);
    },
  };
}

function knowledgeSnapshot(seed: number, ticks: number): string {
  const world = createWorld(seed, {
    southAttractionEnabled: false,
  });

  spawnEntity(
    world,
    { kind: 'polygon', sides: 4, size: 14, irregular: false },
    { type: 'straightDrift', vx: 1, vy: 0, boundary: 'wrap' },
    { x: 200, y: 200 },
  );
  spawnEntity(
    world,
    { kind: 'circle', size: 14 },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: 200, y: 200 },
  );
  spawnEntity(
    world,
    { kind: 'segment', size: 24 },
    { type: 'straightDrift', vx: 0, vy: 1, boundary: 'wrap' },
    { x: 260, y: 200 },
  );
  spawnEntity(
    world,
    { kind: 'polygon', sides: 5, size: 16, irregular: false },
    { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
    { x: 260, y: 200 },
  );

  const systems = [
    new SouthAttractionSystem(),
    new PeaceCrySystem(),
    new VisionSystem(),
    new AvoidanceSteeringSystem(),
    new FeelingApproachSystem(),
    new MovementSystem(),
    new CollisionSystem(),
    new FeelingSystem(),
  ];

  const simulation = new FixedTimestepSimulation(world, systems);
  for (let i = 0; i < ticks; i += 1) {
    simulation.stepOneTick();
  }

  const rows = [...world.knowledge.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, knowledge]) => ({
      id,
      known: [...knowledge.known.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([otherId, info]) => ({
          otherId,
          rank: info.rank,
          learnedAtTick: info.learnedAtTick,
          learnedBy: info.learnedBy,
        })),
    }));

  return JSON.stringify(rows);
}

describe('recognition by feeling', () => {
  it('learns rank from safe low-speed contact', () => {
    const { world, step } = runCollisionAndFeeling(501);
    world.config.feelSpeedThreshold = 6;
    world.tick = 1;

    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'straightDrift', vx: 1, vy: 0, boundary: 'wrap' },
      { x: 220, y: 210 },
    );
    const b = spawnEntity(
      world,
      { kind: 'circle', size: 16 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 220, y: 210 },
    );

    step();

    const aKnowledge = world.knowledge.get(a);
    const bKnowledge = world.knowledge.get(b);
    const aKnows = aKnowledge?.known.get(b);
    const bKnows = bKnowledge?.known.get(a);

    expect(aKnows?.learnedBy).toBe('feeling');
    expect(bKnows?.learnedBy).toBe('feeling');
    expect(aKnows?.rank).toBe(world.ranks.get(b)?.rank);
    expect(bKnows?.rank).toBe(world.ranks.get(a)?.rank);
  });

  it('does not learn from high-speed contact', () => {
    const { world, step } = runCollisionAndFeeling(502);
    world.config.feelSpeedThreshold = 2;
    world.tick = 1;

    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'straightDrift', vx: 12, vy: 0, boundary: 'wrap' },
      { x: 240, y: 220 },
    );
    const b = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 14, irregular: false },
      { type: 'straightDrift', vx: -11, vy: 0, boundary: 'wrap' },
      { x: 240, y: 220 },
    );

    step();

    expect(world.knowledge.get(a)?.known.size ?? 0).toBe(0);
    expect(world.knowledge.get(b)?.known.size ?? 0).toBe(0);
  });

  it('emits touch events for safe contact even when cooldown blocks handshake', () => {
    const { world, step } = runCollisionAndFeeling(503);
    world.config.feelSpeedThreshold = 6;
    world.tick = 10;

    const a = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 14, irregular: false },
      { type: 'straightDrift', vx: 1, vy: 0, boundary: 'wrap' },
      { x: 240, y: 220 },
    );
    const b = spawnEntity(
      world,
      { kind: 'circle', size: 16 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 240, y: 220 },
    );

    const aFeeling = world.feeling.get(a);
    const bFeeling = world.feeling.get(b);
    if (!aFeeling || !bFeeling) {
      throw new Error('Missing feeling components for touch emission test.');
    }
    aFeeling.lastFeltTick = world.tick;
    bFeeling.lastFeltTick = world.tick;
    aFeeling.feelCooldownTicks = 999;
    bFeeling.feelCooldownTicks = 999;

    step();

    const events = world.events.drain();
    expect(events.some((event) => event.type === 'touch')).toBe(true);
    expect(events.some((event) => event.type === 'handshake')).toBe(false);
    expect(world.knowledge.get(a)?.known.size ?? 0).toBe(0);
    expect(world.knowledge.get(b)?.known.size ?? 0).toBe(0);
  });

  it('produces deterministic known sets for same seed and setup', () => {
    const a = knowledgeSnapshot(1337, 10);
    const b = knowledgeSnapshot(1337, 10);

    expect(a).toBe(b);

    const parsed = JSON.parse(a) as Array<{ id: number; known: Array<unknown> }>;
    const knownTotal = parsed.reduce((acc, row) => acc + row.known.length, 0);
    expect(knownTotal).toBeGreaterThan(0);
  });
});
