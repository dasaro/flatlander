import { describe, expect, it } from 'vitest';

import { spawnFromRequest, type SpawnRequest } from '../src/core/factory';
import { FixedTimestepSimulation } from '../src/core/simulation';
import { createWorld } from '../src/core/world';
import { CleanupSystem } from '../src/systems/cleanupSystem';
import { CollisionSystem } from '../src/systems/collisionSystem';
import { CompensationSystem } from '../src/systems/compensationSystem';
import { FeelingApproachSystem } from '../src/systems/feelingApproachSystem';
import { FeelingSystem } from '../src/systems/feelingSystem';
import { HearingSystem } from '../src/systems/hearingSystem';
import { IntelligenceGrowthSystem } from '../src/systems/intelligenceGrowthSystem';
import { LethalitySystem } from '../src/systems/lethalitySystem';
import { CollisionResolutionSystem } from '../src/systems/collisionResolutionSystem';
import { AvoidanceSteeringSystem } from '../src/systems/avoidanceSteeringSystem';
import { MovementSystem } from '../src/systems/movementSystem';
import { PeaceCrySystem } from '../src/systems/peaceCrySystem';
import { ReproductionSystem } from '../src/systems/reproductionSystem';
import { SouthAttractionSystem } from '../src/systems/southAttractionSystem';
import { StillnessSystem } from '../src/systems/stillnessSystem';
import { SwaySystem } from '../src/systems/swaySystem';
import { VisionSystem } from '../src/systems/visionSystem';
import { RegularizationSystem } from '../src/systems/regularizationSystem';

function buildSnapshot(seed: number, plan: SpawnRequest[], ticks: number): string {
  const world = createWorld(seed);
  for (const request of plan) {
    spawnFromRequest(world, request);
  }

  const systems = [
    new SouthAttractionSystem(),
    new IntelligenceGrowthSystem(),
    new StillnessSystem(),
    new PeaceCrySystem(),
    new HearingSystem(),
    new VisionSystem(),
    new AvoidanceSteeringSystem(),
    new FeelingApproachSystem(),
    new MovementSystem(),
    new SwaySystem(),
    new CompensationSystem(),
    new RegularizationSystem(),
    new CollisionSystem(),
    new FeelingSystem(),
    new CollisionResolutionSystem(),
    new LethalitySystem(),
    new CleanupSystem(),
    new ReproductionSystem(),
  ];
  const simulation = new FixedTimestepSimulation(world, systems);

  for (let i = 0; i < ticks; i += 1) {
    simulation.stepOneTick();
  }

  const ids = [...world.entities].sort((a, b) => a - b);
  const rows = ids.map((id) => {
    const transform = world.transforms.get(id);
    const shape = world.shapes.get(id);
    const movement = world.movements.get(id);
    return {
      id,
      kind: shape?.kind,
      x: Number(transform?.position.x.toFixed(6)),
      y: Number(transform?.position.y.toFixed(6)),
      rotation: Number((transform?.rotation ?? 0).toFixed(6)),
      movementType: movement?.type,
    };
  });

  return JSON.stringify({ tick: world.tick, rows });
}

describe('deterministic simulation', () => {
  it('produces the same state for same seed and spawn config', () => {
    const plan: SpawnRequest[] = [
      {
        shape: {
          kind: 'segment',
          size: 24,
        },
        movement: {
          type: 'randomWalk',
          speed: 25,
          turnRate: 2,
          boundary: 'wrap',
        },
        count: 8,
      },
      {
        shape: {
          kind: 'polygon',
          sides: 7,
          size: 18,
          irregular: true,
        },
        movement: {
          type: 'seekPoint',
          speed: 20,
          turnRate: 1.5,
          boundary: 'wrap',
          target: { x: 300, y: 250 },
        },
        count: 6,
      },
      {
        shape: {
          kind: 'circle',
          size: 13,
        },
        movement: {
          type: 'straightDrift',
          vx: 12,
          vy: -7,
          boundary: 'wrap',
        },
        count: 3,
      },
    ];

    const a = buildSnapshot(1337, plan, 120);
    const b = buildSnapshot(1337, plan, 120);

    expect(a).toBe(b);
  });
});
