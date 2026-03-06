import { FixedTimestepSimulation } from '../core/simulation';
import { createDefaultWorld } from './defaultScenario';
import { AvoidanceSteeringSystem } from '../systems/avoidanceSteeringSystem';
import { CleanupSystem } from '../systems/cleanupSystem';
import { CollisionResolutionSystem } from '../systems/collisionResolutionSystem';
import { CollisionSystem } from '../systems/collisionSystem';
import { CompensationSystem } from '../systems/compensationSystem';
import { CrowdStressSystem } from '../systems/crowdStressSystem';
import { ErosionSystem } from '../systems/erosionSystem';
import { AgeDeteriorationSystem } from '../systems/ageDeteriorationSystem';
import { FeelingApproachSystem } from '../systems/feelingApproachSystem';
import { FeelingSystem } from '../systems/feelingSystem';
import { HearingSystem } from '../systems/hearingSystem';
import { HouseSystem } from '../systems/houseSystem';
import { IntelligenceGrowthSystem } from '../systems/intelligenceGrowthSystem';
import { IntroductionIntentSystem } from '../systems/introductionIntentSystem';
import { LethalitySystem } from '../systems/lethalitySystem';
import { MovementSystem } from '../systems/movementSystem';
import { NeoTherapySystem } from '../systems/neoTherapySystem';
import { PeaceCrySystem } from '../systems/peaceCrySystem';
import { PolicyRegimeSystem } from '../systems/policyRegimeSystem';
import { CivicOrderSystem } from '../systems/civicOrderSystem';
import { RainSystem } from '../systems/rainSystem';
import { InspectionSystem } from '../systems/inspectionSystem';
import { RegularizationSystem } from '../systems/regularizationSystem';
import { ReproductionSystem } from '../systems/reproductionSystem';
import { SleepSystem } from '../systems/sleepSystem';
import { SocialNavMindSystem } from '../systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from '../systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from '../systems/southAttractionSystem';
import { StillnessControllerSystem } from '../systems/stillnessControllerSystem';
import { SwaySystem } from '../systems/swaySystem';
import type { System } from '../systems/system';
import { VisionSystem } from '../systems/visionSystem';

// Shared source of truth for the shipped deterministic stack.
// Release audits and long-running tests should use this rather than duplicating near-matches.
export function createDefaultSystems(): System[] {
  return [
    // Peace-cry must run before hearing and SocialNav mind so etiquette reacts to same-tick signals.
    new PeaceCrySystem(),
    new RainSystem(),
    // Policy regime is computed before deliberative behavior and enforcement.
    new PolicyRegimeSystem(),
    new HearingSystem(),
    new VisionSystem(),
    new SocialNavMindSystem(),
    // Social/political civic constraints can override intent choices during rain.
    new CivicOrderSystem(),
    new FeelingApproachSystem(),
    new IntroductionIntentSystem(),
    // Inspection can impose stillness requests before they are resolved.
    new InspectionSystem(),
    // Consume stillness requests after intent systems and before force/steering/movement.
    new StillnessControllerSystem(),
    new SouthAttractionSystem(),
    new IntelligenceGrowthSystem(),
    new SleepSystem(),
    new SocialNavSteeringSystem(),
    new AvoidanceSteeringSystem(),
    new MovementSystem(),
    new SwaySystem(),
    new CrowdStressSystem(),
    new CompensationSystem(),
    new RegularizationSystem(),
    new CollisionSystem(),
    // House entry consumes fresh collision contact points before separation correction.
    new HouseSystem(),
    // Feeling consumes fresh collision contacts and can request stillness before separation correction.
    new FeelingSystem(),
    new CollisionResolutionSystem(),
    new ErosionSystem(),
    new AgeDeteriorationSystem(),
    new LethalitySystem(),
    new CleanupSystem(),
    new ReproductionSystem(),
    new NeoTherapySystem(),
  ];
}

export function createDefaultSimulation(seed: number): FixedTimestepSimulation {
  return new FixedTimestepSimulation(createDefaultWorld(seed), createDefaultSystems());
}
