import './styles.css';

import type { BoundaryMode, MovementComponent } from './core/components';
import { spawnFromRequest, type SpawnMovementConfig, type SpawnRequest } from './core/factory';
import { FixedTimestepSimulation } from './core/simulation';
import { boundaryFromTopology, type WorldTopology } from './core/topology';
import { createWorld, type WorldConfig } from './core/world';
import type { Vec2 } from './geometry/vector';
import { Camera } from './render/camera';
import { CanvasRenderer } from './render/canvasRenderer';
import { CleanupSystem } from './systems/cleanupSystem';
import { CollisionSystem } from './systems/collisionSystem';
import { LethalitySystem } from './systems/lethalitySystem';
import { AvoidanceSteeringSystem } from './systems/avoidanceSteeringSystem';
import { MovementSystem } from './systems/movementSystem';
import { SouthAttractionSystem } from './systems/southAttractionSystem';
import { VisionSystem } from './systems/visionSystem';
import { PickingController } from './ui/pickingController';
import { SelectionState } from './ui/selectionState';
import { type SouthAttractionSettings, UIController } from './ui/uiController';

const canvas = document.getElementById('world-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #world-canvas canvas element.');
}

const initialSeedInput = document.getElementById('seed-input');
if (!(initialSeedInput instanceof HTMLInputElement)) {
  throw new Error('Missing #seed-input input element.');
}
const topologyInput = document.getElementById('world-topology');
if (!(topologyInput instanceof HTMLSelectElement)) {
  throw new Error('Missing #world-topology select element.');
}

const systems = [
  new SouthAttractionSystem(),
  new VisionSystem(),
  new AvoidanceSteeringSystem(),
  new MovementSystem(),
  new CollisionSystem(),
  new LethalitySystem(),
  new CleanupSystem(),
];

let worldTopology: WorldTopology = topologyInput.value === 'bounded' ? 'bounded' : 'torus';
const initialBoundary = boundaryFromTopology(worldTopology);
let spawnPlan: SpawnRequest[] = applyBoundaryToSpawnPlan(defaultSpawnPlan(), initialBoundary);
let southAttractionSettings: SouthAttractionSettings = {
  enabled: true,
  strength: 2,
  womenMultiplier: 2,
  zoneStartFrac: 0.75,
  zoneEndFrac: 0.95,
  drag: 10,
  maxTerminal: 2,
  showSouthZoneOverlay: false,
  showClickDebug: false,
};
let world = createWorld(
  readInitialSeed(initialSeedInput.value),
  settingsToWorldConfig(southAttractionSettings, worldTopology),
);
applySpawnPlan(world, spawnPlan);

const simulation = new FixedTimestepSimulation(world, systems);
const renderer = new CanvasRenderer(canvas, world.config.width, world.config.height);
const camera = new Camera(world.config.width, world.config.height);
const selectionState = new SelectionState();
let debugClickPoint: Vec2 | null = null;

const ui = new UIController({
  onToggleRun: () => simulation.toggleRunning(),
  onStep: () => {
    simulation.stepOneTick();
    ensureSelectionStillAlive();
  },
  onReset: (seed) => {
    simulation.setRunning(false);
    world = createWorld(seed, settingsToWorldConfig(southAttractionSettings, worldTopology));
    applySpawnPlan(world, spawnPlan);
    simulation.setWorld(world);
    selectionState.setSelected(null);
    camera.reset(world.config.width, world.config.height);
    debugClickPoint = null;
    renderSelection();
  },
  onSpawn: (request) => {
    const normalizedRequest = applyBoundaryToSpawnRequest(request, boundaryFromTopology(worldTopology));
    spawnPlan = [...spawnPlan, normalizedRequest];
    spawnFromRequest(world, normalizedRequest);
  },
  onTopologyUpdate: (topology) => {
    applyTopology(topology);
  },
  onSouthAttractionUpdate: (settings) => {
    southAttractionSettings = settings;
    world.config.southAttractionEnabled = settings.enabled;
    world.config.southAttractionStrength = settings.strength;
    world.config.southAttractionWomenMultiplier = settings.womenMultiplier;
    world.config.southAttractionZoneStartFrac = settings.zoneStartFrac;
    world.config.southAttractionZoneEndFrac = settings.zoneEndFrac;
    world.config.southAttractionDrag = settings.drag;
    world.config.southAttractionMaxTerminal = settings.maxTerminal;
  },
  onInspectorUpdate: (movementConfig) => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null) {
      return;
    }

    const current = world.movements.get(selectedId);
    const transform = world.transforms.get(selectedId);
    if (!current || !transform) {
      return;
    }

    world.movements.set(
      selectedId,
      mergeMovement(
        current,
        movementConfig,
        transform.rotation,
        boundaryFromTopology(worldTopology),
      ),
    );
    renderSelection();
  },
  onInspectorVisionUpdate: (visionConfig) => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null) {
      return;
    }

    const currentVision = world.vision.get(selectedId);
    if (!currentVision) {
      return;
    }

    world.vision.set(selectedId, {
      ...currentVision,
      ...visionConfig,
      range: Math.max(0, visionConfig.range ?? currentVision.range),
      avoidDistance: Math.max(0, visionConfig.avoidDistance ?? currentVision.avoidDistance),
      avoidTurnRate: Math.max(0, visionConfig.avoidTurnRate ?? currentVision.avoidTurnRate),
    });
    renderSelection();
  },
});

selectionState.subscribe(() => {
  renderSelection();
});

const pickingController = new PickingController({
  canvas,
  camera,
  selectionState,
  getWorld: () => world,
  onClickWorldPoint: (point) => {
    debugClickPoint = point;
  },
  onSelectionApplied: () => {
    renderSelection();
  },
  tolerancePx: 10,
  dragThresholdPx: 7,
});
pickingController.attach();

function frame(now: number): void {
  simulation.frame(now);
  ensureSelectionStillAlive();

  const clickPoint = debugClickPoint;
  debugClickPoint = null;

  renderer.render(world, camera, selectionState.selectedId, {
    showSouthZoneOverlay: southAttractionSettings.showSouthZoneOverlay,
    debugClickPoint: southAttractionSettings.showClickDebug ? clickPoint : null,
  });
  ui.renderStats(world);
  requestAnimationFrame(frame);
}

renderSelection();
requestAnimationFrame(frame);

function renderSelection(): void {
  const selectedId = selectionState.selectedId;
  if (selectedId === null) {
    ui.renderSelected(null, null, null, null, null);
    return;
  }

  const movement = world.movements.get(selectedId) ?? null;
  const shape = world.shapes.get(selectedId) ?? null;
  const rank = world.ranks.get(selectedId) ?? null;
  const vision = world.vision.get(selectedId) ?? null;
  if (!movement || !shape || !rank || !vision) {
    selectionState.setSelected(null);
    ui.renderSelected(null, null, null, null, null);
    return;
  }

  ui.renderSelected(selectedId, movement, shape, rank, vision);
}

function applyTopology(topology: WorldTopology): void {
  worldTopology = topology;
  world.config.topology = worldTopology;
  const boundary = boundaryFromTopology(worldTopology);

  for (const [entityId, movement] of world.movements) {
    world.movements.set(entityId, withMovementBoundary(movement, boundary));
  }

  spawnPlan = applyBoundaryToSpawnPlan(spawnPlan, boundary);
  renderSelection();
}

function ensureSelectionStillAlive(): void {
  const selectedId = selectionState.selectedId;
  if (selectedId !== null && !world.entities.has(selectedId)) {
    selectionState.setSelected(null);
  }
}

function readInitialSeed(raw: string): number {
  const seed = Number.parseInt(raw, 10);
  return Number.isFinite(seed) ? seed : 1;
}

function applySpawnPlan(targetWorld: typeof world, plan: SpawnRequest[]): void {
  for (const request of plan) {
    spawnFromRequest(targetWorld, request);
  }
}

function mergeMovement(
  current: MovementComponent,
  update: SpawnMovementConfig,
  fallbackHeading: number,
  boundary: BoundaryMode,
): MovementComponent {
  if (update.type === 'straightDrift') {
    return {
      type: 'straightDrift',
      boundary,
      vx: update.vx,
      vy: update.vy,
    };
  }

  const inheritedHeading =
    current.type === 'straightDrift' ? fallbackHeading : Number.isFinite(current.heading) ? current.heading : 0;

  if (update.type === 'randomWalk') {
    return {
      type: 'randomWalk',
      boundary,
      speed: update.speed,
      turnRate: update.turnRate,
      heading: inheritedHeading,
    };
  }

  return {
    type: 'seekPoint',
    boundary,
    speed: update.speed,
    turnRate: update.turnRate,
    target: update.target,
    heading: inheritedHeading,
  };
}

function defaultSpawnPlan(): SpawnRequest[] {
  return [
    {
      shape: {
        kind: 'segment',
        size: 24,
      },
      movement: {
        type: 'randomWalk',
        speed: 38,
        turnRate: 2.7,
        boundary: 'wrap',
      },
      count: 16,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 3,
        size: 18,
        irregular: false,
        triangleKind: 'Equilateral',
      },
      movement: {
        type: 'randomWalk',
        speed: 28,
        turnRate: 1.7,
        boundary: 'wrap',
      },
      count: 12,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 3,
        size: 18,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.05,
      },
      movement: {
        type: 'randomWalk',
        speed: 30,
        turnRate: 1.9,
        boundary: 'wrap',
      },
      count: 8,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 5,
        size: 22,
        irregular: false,
      },
      movement: {
        type: 'straightDrift',
        vx: 26,
        vy: -19,
        boundary: 'wrap',
      },
      count: 8,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 8,
        size: 25,
        irregular: false,
      },
      movement: {
        type: 'seekPoint',
        speed: 21,
        turnRate: 1.3,
        target: { x: 500, y: 350 },
        boundary: 'wrap',
      },
      count: 6,
    },
    {
      shape: {
        kind: 'circle',
        size: 14,
      },
      movement: {
        type: 'straightDrift',
        vx: -14,
        vy: 31,
        boundary: 'wrap',
      },
      count: 3,
    },
  ];
}

function settingsToWorldConfig(
  settings: SouthAttractionSettings,
  topology: WorldTopology,
): Partial<WorldConfig> {
  return {
    topology,
    southAttractionEnabled: settings.enabled,
    southAttractionStrength: settings.strength,
    southAttractionWomenMultiplier: settings.womenMultiplier,
    southAttractionZoneStartFrac: settings.zoneStartFrac,
    southAttractionZoneEndFrac: settings.zoneEndFrac,
    southAttractionDrag: settings.drag,
    southAttractionMaxTerminal: settings.maxTerminal,
  };
}

function withMovementBoundary(movement: MovementComponent, boundary: BoundaryMode): MovementComponent {
  return {
    ...movement,
    boundary,
  };
}

function applyBoundaryToSpawnRequest(request: SpawnRequest, boundary: BoundaryMode): SpawnRequest {
  return {
    ...request,
    movement: {
      ...request.movement,
      boundary,
    },
  };
}

function applyBoundaryToSpawnPlan(plan: SpawnRequest[], boundary: BoundaryMode): SpawnRequest[] {
  return plan.map((request) => applyBoundaryToSpawnRequest(request, boundary));
}
