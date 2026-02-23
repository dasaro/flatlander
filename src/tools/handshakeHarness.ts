import { spawnEntity } from '../core/factory';
import { FixedTimestepSimulation } from '../core/simulation';
import { createWorld } from '../core/world';
import { AvoidanceSteeringSystem } from '../systems/avoidanceSteeringSystem';
import { CollisionSystem } from '../systems/collisionSystem';
import { FeelingApproachSystem } from '../systems/feelingApproachSystem';
import { FeelingSystem } from '../systems/feelingSystem';
import { HearingSystem } from '../systems/hearingSystem';
import { IntroductionIntentSystem } from '../systems/introductionIntentSystem';
import { MovementSystem } from '../systems/movementSystem';
import { PeaceCrySystem } from '../systems/peaceCrySystem';
import { SleepSystem } from '../systems/sleepSystem';
import { SocialNavMindSystem } from '../systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../systems/southAttractionSystem';
import { StillnessControllerSystem } from '../systems/stillnessControllerSystem';
import { VisionSystem } from '../systems/visionSystem';

const TICKS = 5_000;

function buildWorld(seed: number) {
  const world = createWorld(seed, {
    southAttractionEnabled: false,
    topology: 'bounded',
    introductionRadius: 160,
    preContactRadius: 24,
    handshakeStillnessTicks: 12,
    handshakeCooldownTicks: 36,
  });

  for (let i = 0; i < 24; i += 1) {
    spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      {
        type: 'socialNav',
        boundary: 'bounce',
        maxSpeed: 13,
        maxTurnRate: 1.35,
        decisionEveryTicks: 16,
        intentionMinTicks: 80,
      },
    );
  }

  for (let i = 0; i < 22; i += 1) {
    spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: i % 2 === 0 ? 3 : 4,
        size: 17,
        irregular: false,
        ...(i % 2 === 0 ? { triangleKind: 'Equilateral' as const } : {}),
      },
      {
        type: 'socialNav',
        boundary: 'bounce',
        maxSpeed: 13,
        maxTurnRate: 1.1,
        decisionEveryTicks: 18,
        intentionMinTicks: 86,
      },
    );
  }

  return world;
}

function runHarness(seed: number): void {
  const world = buildWorld(seed);
  const systems = [
    new PeaceCrySystem(),
    new HearingSystem(),
    new VisionSystem(),
    new SocialNavMindSystem(),
    new FeelingApproachSystem(),
    new IntroductionIntentSystem(),
    new StillnessControllerSystem(),
    new SouthAttractionSystem(),
    new SleepSystem(),
    new SocialNavSteeringSystem(),
    new AvoidanceSteeringSystem(),
    new MovementSystem(),
    new CollisionSystem(),
    new FeelingSystem(),
  ];
  const simulation = new FixedTimestepSimulation(world, systems);

  let totalStillnessTicks = 0;
  let started = 0;
  let completed = 0;
  let knowledgeEdges = 0;
  let previousKnowledgeEdges = 0;

  for (let i = 0; i < TICKS; i += 1) {
    simulation.stepOneTick();
    totalStillnessTicks += world.stillness.size;
    started += world.handshakeStartedThisTick;
    completed += world.handshakeCompletedThisTick;

    const currentKnowledgeEdges = [...world.knowledge.values()].reduce(
      (sum, knowledge) => sum + knowledge.known.size,
      0,
    );
    if (currentKnowledgeEdges > previousKnowledgeEdges) {
      knowledgeEdges += currentKnowledgeEdges - previousKnowledgeEdges;
      previousKnowledgeEdges = currentKnowledgeEdges;
    }
  }

  console.log(`Handshake Harness (seed=${seed}, ticks=${TICKS})`);
  console.log(`  stillnessTicksTotal: ${totalStillnessTicks}`);
  console.log(`  handshakeStarted: ${started}`);
  console.log(`  handshakeCompleted: ${completed}`);
  console.log(`  knowledgeEdgesCreated: ${knowledgeEdges}`);
  console.log(
    `  handshakesPer1000Ticks: ${((completed * 1000) / Math.max(1, world.tick)).toFixed(2)}`,
  );
}

const seedArg = Number.parseInt(process.argv[2] ?? '42', 10);
const seed = Number.isFinite(seedArg) ? seedArg : 42;
runHarness(seed);
