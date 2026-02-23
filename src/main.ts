import './styles.css';

import type { BoundaryMode, MovementComponent } from './core/components';
import { spawnFromRequest, type SpawnMovementConfig, type SpawnRequest } from './core/factory';
import { FixedTimestepSimulation } from './core/simulation';
import { boundaryFromTopology, type WorldTopology } from './core/topology';
import { spawnHouses } from './core/worldgen/houses';
import { createWorld, type WorldConfig } from './core/world';
import type { Vec2 } from './geometry/vector';
import { Camera } from './render/camera';
import { CanvasRenderer } from './render/canvasRenderer';
import { EffectsManager } from './render/effects';
import { computeFlatlanderScan, type FlatlanderScanResult } from './render/flatlanderScan';
import { FlatlanderViewRenderer } from './render/flatlanderViewRenderer';
import { PopulationHistogram } from './render/populationHistogram';
import { HearingSystem } from './systems/hearingSystem';
import { PeaceCrySystem } from './systems/peaceCrySystem';
import { CleanupSystem } from './systems/cleanupSystem';
import { CollisionSystem } from './systems/collisionSystem';
import { FeelingApproachSystem } from './systems/feelingApproachSystem';
import { FeelingSystem } from './systems/feelingSystem';
import { IntelligenceGrowthSystem } from './systems/intelligenceGrowthSystem';
import { LethalitySystem } from './systems/lethalitySystem';
import { CollisionResolutionSystem } from './systems/collisionResolutionSystem';
import { AvoidanceSteeringSystem } from './systems/avoidanceSteeringSystem';
import { MovementSystem } from './systems/movementSystem';
import { ReproductionSystem } from './systems/reproductionSystem';
import { SouthAttractionSystem } from './systems/southAttractionSystem';
import { StillnessSystem } from './systems/stillnessSystem';
import { SwaySystem } from './systems/swaySystem';
import { VisionSystem } from './systems/visionSystem';
import { CompensationSystem } from './systems/compensationSystem';
import { RegularizationSystem } from './systems/regularizationSystem';
import { PickingController } from './ui/pickingController';
import { SelectionState } from './ui/selectionState';
import {
  type EnvironmentSettings,
  type EventHighlightsSettings,
  type FlatlanderViewSettings,
  type FogSightSettings,
  type PeaceCrySettings,
  type ReproductionSettings,
  type SouthAttractionSettings,
  UIController,
} from './ui/uiController';

const canvas = document.getElementById('world-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #world-canvas canvas element.');
}
const histogramCanvas = document.getElementById('population-histogram');
if (!(histogramCanvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #population-histogram canvas element.');
}
const flatlanderCanvas = document.getElementById('flatlander-canvas');
if (!(flatlanderCanvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #flatlander-canvas canvas element.');
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

let worldTopology: WorldTopology = topologyInput.value === 'bounded' ? 'bounded' : 'torus';
const initialBoundary = boundaryFromTopology(worldTopology);
let spawnPlan: SpawnRequest[] = applyBoundaryToSpawnPlan(defaultSpawnPlan(), initialBoundary);
let environmentSettings: EnvironmentSettings = {
  housesEnabled: true,
  houseCount: 12,
  townPopulation: 5000,
  allowTriangularForts: false,
  allowSquareHouses: true,
  houseSize: 30,
};
let peaceCrySettings: PeaceCrySettings = {
  enabled: true,
  cadenceTicks: 20,
  radius: 120,
};
let reproductionSettings: ReproductionSettings = {
  enabled: true,
  gestationTicks: 220,
  matingRadius: 60,
  conceptionChancePerTick: 0.0035,
  femaleBirthProbability: 0.5,
  maxPopulation: 500,
};
let eventHighlightsSettings: EventHighlightsSettings = {
  enabled: true,
  intensity: 1,
  capPerTick: 120,
};
let flatlanderViewSettings: FlatlanderViewSettings = {
  enabled: true,
  rays: 720,
  fovRad: Math.PI * 2,
  lookOffsetRad: 0,
  maxDistance: 400,
  fogDensity: 0.006,
  minVisibleIntensity: 0.06,
  grayscaleMode: true,
  includeObstacles: true,
  inanimateDimMultiplier: 0.65,
};
let fogSightSettings: FogSightSettings = {
  sightEnabled: true,
  fogDensity: 0.006,
};
let southAttractionSettings: SouthAttractionSettings = {
  enabled: true,
  strength: 2,
  womenMultiplier: 2,
  zoneStartFrac: 0.75,
  zoneEndFrac: 0.95,
  drag: 12,
  maxTerminal: 1.8,
  escapeFraction: 0.5,
  showSouthZoneOverlay: false,
  showClickDebug: false,
};
let world = createWorld(
  readInitialSeed(initialSeedInput.value),
      settingsToWorldConfig(
        southAttractionSettings,
        worldTopology,
        environmentSettings,
        peaceCrySettings,
        reproductionSettings,
        fogSightSettings,
      ),
    );
populateWorld(world, spawnPlan, environmentSettings);

const simulation = new FixedTimestepSimulation(world, systems);
const renderer = new CanvasRenderer(canvas, world.config.width, world.config.height);
const effectsManager = new EffectsManager();
effectsManager.setSettings(eventHighlightsSettings);
const flatlanderViewRenderer = new FlatlanderViewRenderer(flatlanderCanvas);
const populationHistogram = new PopulationHistogram(histogramCanvas);
populationHistogram.reset(world);
const camera = new Camera(world.config.width, world.config.height);
const selectionState = new SelectionState();
let debugClickPoint: Vec2 | null = null;
let lastRenderTimeMs = 0;
let lastFlatlanderScanTick = -1;
let lastFlatlanderScanViewerId: number | null = null;
let lastFlatlanderScanConfigKey = '';
let cachedFlatlanderScan: FlatlanderScanResult | null = null;
let flatlanderScanDirty = true;

const ui = new UIController({
  onToggleRun: () => simulation.toggleRunning(),
  onStep: () => {
    simulation.stepOneTick();
    ensureSelectionStillAlive();
  },
  onReset: (seed) => {
    simulation.setRunning(false);
    world = createWorld(
      seed,
      settingsToWorldConfig(
        southAttractionSettings,
        worldTopology,
        environmentSettings,
        peaceCrySettings,
        reproductionSettings,
        fogSightSettings,
      ),
    );
    populateWorld(world, spawnPlan, environmentSettings);
    simulation.setWorld(world);
    effectsManager.clear();
    populationHistogram.reset(world);
    selectionState.setSelected(null);
    camera.reset(world.config.width, world.config.height);
    cachedFlatlanderScan = null;
    flatlanderScanDirty = true;
    lastFlatlanderScanTick = -1;
    lastFlatlanderScanViewerId = null;
    lastFlatlanderScanConfigKey = '';
    debugClickPoint = null;
    lastRenderTimeMs = 0;
    renderSelection();
  },
  onSpawn: (request) => {
    const normalizedRequest = applyBoundaryToSpawnRequest(request, boundaryFromTopology(worldTopology));
    spawnPlan = [...spawnPlan, normalizedRequest];
    spawnFromRequest(world, normalizedRequest);
    flatlanderScanDirty = true;
  },
  onTopologyUpdate: (topology) => {
    applyTopology(topology);
  },
  onEnvironmentUpdate: (settings) => {
    environmentSettings = {
      ...settings,
      allowSquareHouses: settings.townPopulation >= 10_000 ? false : settings.allowSquareHouses,
    };
    applyEnvironmentSettingsToWorld(world, environmentSettings);
  },
  onPeaceCryDefaultsUpdate: (settings) => {
    peaceCrySettings = settings;
    applyPeaceCrySettingsToWorld(world, peaceCrySettings);
  },
  onApplyPeaceCryDefaultsToWomen: () => {
    applyPeaceCryDefaultsToWomen(world);
    renderSelection();
  },
  onReproductionUpdate: (settings) => {
    reproductionSettings = settings;
    applyReproductionSettingsToWorld(world, reproductionSettings);
  },
  onEventHighlightsUpdate: (settings) => {
    eventHighlightsSettings = settings;
    effectsManager.setSettings(settings);
  },
  onClearEventHighlights: () => {
    effectsManager.clear();
  },
  onFlatlanderViewUpdate: (settings) => {
    flatlanderViewSettings = settings;
    flatlanderScanDirty = true;
  },
  onFogSightUpdate: (settings) => {
    fogSightSettings = settings;
    world.config.sightEnabled = settings.sightEnabled;
    world.config.fogDensity = settings.fogDensity;
  },
  onApplyNovelSafetyPreset: () => {
    applyNovelSafetyPreset(world);
    spawnPlan = applyNovelSafetyPresetToPlan(spawnPlan);
    renderSelection();
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
    world.config.southEscapeFraction = settings.escapeFraction;
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
  onInspectorPerceptionUpdate: (perceptionConfig) => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null) {
      return;
    }

    const current = world.perceptions.get(selectedId);
    if (!current) {
      return;
    }

    world.perceptions.set(selectedId, {
      ...current,
      ...perceptionConfig,
      sightSkill: Math.max(0, Math.min(1, perceptionConfig.sightSkill ?? current.sightSkill)),
      hearingSkill: Math.max(0, Math.min(1, perceptionConfig.hearingSkill ?? current.hearingSkill)),
      hearingRadius: Math.max(0, perceptionConfig.hearingRadius ?? current.hearingRadius),
    });
    renderSelection();
  },
  onInspectorVoiceUpdate: (voiceConfig) => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null) {
      return;
    }

    const current = world.voices.get(selectedId);
    if (!current) {
      return;
    }

    const nextMimicryEnabled = Boolean(voiceConfig.mimicryEnabled);
    world.voices.set(selectedId, {
      ...current,
      mimicryEnabled: nextMimicryEnabled,
      mimicrySignature: nextMimicryEnabled
        ? (voiceConfig.mimicrySignature ?? current.mimicrySignature ?? 'Square')
        : null,
    });
    renderSelection();
  },
  onInspectorPeaceCryUpdate: (peaceCryConfig) => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null) {
      return;
    }

    const current = world.peaceCry.get(selectedId);
    if (!current) {
      return;
    }

    world.peaceCry.set(selectedId, {
      ...current,
      ...peaceCryConfig,
      cadenceTicks: Math.max(1, Math.round(peaceCryConfig.cadenceTicks ?? current.cadenceTicks)),
      radius: Math.max(0, peaceCryConfig.radius ?? current.radius),
    });
    renderSelection();
  },
  onInspectorFeelingUpdate: (feelingConfig) => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null) {
      return;
    }

    const current = world.feeling.get(selectedId);
    if (!current) {
      return;
    }

    world.feeling.set(selectedId, {
      ...current,
      ...feelingConfig,
      approachSpeed: Math.max(0, feelingConfig.approachSpeed ?? current.approachSpeed),
      feelCooldownTicks: Math.max(
        0,
        Math.round(feelingConfig.feelCooldownTicks ?? current.feelCooldownTicks),
      ),
    });
    renderSelection();
  },
});

selectionState.subscribe(() => {
  flatlanderScanDirty = true;
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
  const dtVisualSeconds = lastRenderTimeMs === 0 ? 0 : Math.max(0, Math.min(0.25, (now - lastRenderTimeMs) / 1000));
  lastRenderTimeMs = now;

  simulation.frame(now);
  const drainedEvents = world.events.drain();
  effectsManager.ingest(drainedEvents);
  effectsManager.update(dtVisualSeconds);
  populationHistogram.record(world);
  ensureSelectionStillAlive();

  const clickPoint = debugClickPoint;
  debugClickPoint = null;

  renderer.render(world, camera, selectionState.selectedId, {
    showSouthZoneOverlay: southAttractionSettings.showSouthZoneOverlay,
    debugClickPoint: southAttractionSettings.showClickDebug ? clickPoint : null,
    effectsManager,
  });
  renderFlatlanderView();
  populationHistogram.render();
  ui.renderStats(world);
  requestAnimationFrame(frame);
}

renderSelection();
requestAnimationFrame(frame);

function renderSelection(): void {
  const selectedId = selectionState.selectedId;
  if (selectedId === null) {
    ui.renderSelected(
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );
    return;
  }

  const movement = world.movements.get(selectedId) ?? null;
  const shape = world.shapes.get(selectedId) ?? null;
  const rank = world.ranks.get(selectedId) ?? null;
  const vision = world.vision.get(selectedId) ?? null;
  const perception = world.perceptions.get(selectedId) ?? null;
  const voice = world.voices.get(selectedId) ?? null;
  const hearingHit = world.hearingHits.get(selectedId) ?? null;
  const peaceCry = world.peaceCry.get(selectedId) ?? null;
  const feeling = world.feeling.get(selectedId) ?? null;
  const knowledge = world.knowledge.get(selectedId) ?? null;
  const fertility = world.fertility.get(selectedId) ?? null;
  const pregnancy = world.pregnancies.get(selectedId) ?? null;
  const age = world.ages.get(selectedId) ?? null;
  const irregularity = world.irregularity.get(selectedId) ?? null;
  const femaleStatus = world.femaleStatus.get(selectedId) ?? null;
  const sway = world.sway.get(selectedId) ?? null;
  const killCount = world.combatStats.get(selectedId)?.kills ?? 0;
  if (!movement || !shape || !rank || !vision || !perception || !voice || !feeling || !knowledge) {
    selectionState.setSelected(null);
    ui.renderSelected(
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );
    return;
  }

  ui.renderSelected(
    selectedId,
    movement,
    shape,
    rank,
    vision,
    perception,
    voice,
    hearingHit,
    peaceCry,
    feeling,
    knowledge,
    fertility,
    pregnancy,
    age,
    irregularity,
    femaleStatus,
    sway,
    killCount,
  );
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

function flatlanderConfigKey(settings: FlatlanderViewSettings): string {
  return [
    settings.enabled ? '1' : '0',
    settings.rays,
    settings.fovRad.toFixed(6),
    settings.lookOffsetRad.toFixed(6),
    settings.maxDistance.toFixed(3),
    settings.fogDensity.toFixed(6),
    settings.minVisibleIntensity.toFixed(6),
    settings.grayscaleMode ? '1' : '0',
    settings.includeObstacles ? '1' : '0',
    settings.inanimateDimMultiplier.toFixed(3),
  ].join('|');
}

function renderFlatlanderView(): void {
  if (!flatlanderViewSettings.enabled) {
    flatlanderViewRenderer.clearWithMessage('Flatlander view disabled');
    return;
  }

  const selectedId = selectionState.selectedId;
  if (selectedId === null) {
    flatlanderViewRenderer.clearWithMessage('Select an entity');
    return;
  }

  if (!world.entities.has(selectedId)) {
    flatlanderViewRenderer.clearWithMessage('Selected entity removed');
    return;
  }

  const transform = world.transforms.get(selectedId);
  if (!transform) {
    flatlanderViewRenderer.clearWithMessage('No transform for selection');
    return;
  }

  const configKey = flatlanderConfigKey(flatlanderViewSettings);
  if (
    flatlanderScanDirty ||
    world.tick !== lastFlatlanderScanTick ||
    selectedId !== lastFlatlanderScanViewerId ||
    configKey !== lastFlatlanderScanConfigKey
  ) {
    cachedFlatlanderScan = computeFlatlanderScan(world, selectedId, flatlanderViewSettings);
    lastFlatlanderScanTick = world.tick;
    lastFlatlanderScanViewerId = selectedId;
    lastFlatlanderScanConfigKey = configKey;
    flatlanderScanDirty = false;
  }

  if (!cachedFlatlanderScan) {
    flatlanderViewRenderer.clearWithMessage('No scan');
    return;
  }

  flatlanderViewRenderer.render(
    cachedFlatlanderScan,
    flatlanderViewSettings,
    transform.rotation + flatlanderViewSettings.lookOffsetRad,
  );
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

function populateWorld(targetWorld: typeof world, plan: SpawnRequest[], environment: EnvironmentSettings): void {
  spawnHouses(targetWorld, targetWorld.rng, environment);
  applySpawnPlan(targetWorld, plan);
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
        speed: 24,
        turnRate: 2.2,
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
        speed: 20,
        turnRate: 1.6,
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
        speed: 18,
        turnRate: 1.5,
        boundary: 'wrap',
      },
      count: 8,
    },
    {
      shape: {
        kind: 'polygon',
        sides: 6,
        size: 20,
        irregular: true,
      },
      movement: {
        type: 'randomWalk',
        speed: 16,
        turnRate: 1.3,
        boundary: 'wrap',
      },
      count: 5,
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
        vx: 18,
        vy: -14,
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
        speed: 17,
        turnRate: 1.1,
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
        vx: -9,
        vy: 18,
        boundary: 'wrap',
      },
      count: 3,
    },
  ];
}

function settingsToWorldConfig(
  settings: SouthAttractionSettings,
  topology: WorldTopology,
  environment: EnvironmentSettings,
  peaceCry: PeaceCrySettings,
  reproduction: ReproductionSettings,
  fogSight: FogSightSettings,
): Partial<WorldConfig> {
  return {
    topology,
    housesEnabled: environment.housesEnabled,
    houseCount: environment.houseCount,
    townPopulation: environment.townPopulation,
    allowTriangularForts: environment.allowTriangularForts,
    allowSquareHouses: environment.townPopulation >= 10_000 ? false : environment.allowSquareHouses,
    houseSize: environment.houseSize,
    peaceCryEnabled: peaceCry.enabled,
    defaultPeaceCryCadenceTicks: peaceCry.cadenceTicks,
    defaultPeaceCryRadius: peaceCry.radius,
    reproductionEnabled: reproduction.enabled,
    gestationTicks: reproduction.gestationTicks,
    matingRadius: reproduction.matingRadius,
    conceptionChancePerTick: reproduction.conceptionChancePerTick,
    femaleBirthProbability: reproduction.femaleBirthProbability,
    maxPopulation: reproduction.maxPopulation,
    southAttractionEnabled: settings.enabled,
    southAttractionStrength: settings.strength,
    southAttractionWomenMultiplier: settings.womenMultiplier,
    southAttractionZoneStartFrac: settings.zoneStartFrac,
    southAttractionZoneEndFrac: settings.zoneEndFrac,
    southAttractionDrag: settings.drag,
    southAttractionMaxTerminal: settings.maxTerminal,
    southEscapeFraction: settings.escapeFraction,
    sightEnabled: fogSight.sightEnabled,
    fogDensity: fogSight.fogDensity,
  };
}

function applyEnvironmentSettingsToWorld(worldState: typeof world, settings: EnvironmentSettings): void {
  worldState.config.housesEnabled = settings.housesEnabled;
  worldState.config.houseCount = settings.houseCount;
  worldState.config.townPopulation = settings.townPopulation;
  worldState.config.allowTriangularForts = settings.allowTriangularForts;
  worldState.config.allowSquareHouses =
    settings.townPopulation >= 10_000 ? false : settings.allowSquareHouses;
  worldState.config.houseSize = settings.houseSize;
}

function applyPeaceCrySettingsToWorld(worldState: typeof world, settings: PeaceCrySettings): void {
  worldState.config.peaceCryEnabled = settings.enabled;
  worldState.config.defaultPeaceCryCadenceTicks = Math.max(1, Math.round(settings.cadenceTicks));
  worldState.config.defaultPeaceCryRadius = Math.max(0, settings.radius);
}

function applyReproductionSettingsToWorld(
  worldState: typeof world,
  settings: ReproductionSettings,
): void {
  worldState.config.reproductionEnabled = settings.enabled;
  worldState.config.gestationTicks = Math.max(1, Math.round(settings.gestationTicks));
  worldState.config.matingRadius = Math.max(0, settings.matingRadius);
  worldState.config.conceptionChancePerTick = Math.max(0, Math.min(1, settings.conceptionChancePerTick));
  worldState.config.femaleBirthProbability = Math.max(0, Math.min(1, settings.femaleBirthProbability));
  worldState.config.maxPopulation = Math.max(1, Math.round(settings.maxPopulation));
}

function applyPeaceCryDefaultsToWomen(worldState: typeof world): void {
  const cadenceTicks = Math.max(1, Math.round(worldState.config.defaultPeaceCryCadenceTicks));
  const radius = Math.max(0, worldState.config.defaultPeaceCryRadius);

  for (const [entityId, peaceCry] of worldState.peaceCry) {
    if (!worldState.entities.has(entityId)) {
      continue;
    }

    worldState.peaceCry.set(entityId, {
      ...peaceCry,
      enabled: worldState.config.peaceCryEnabled,
      cadenceTicks,
      radius,
    });
  }
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

function applyNovelSafetyPreset(worldState: typeof world): void {
  worldState.config.handshakeStillnessTicks = 12;
  worldState.config.compensationEnabled = true;
  worldState.config.compensationRate = 0.55;
  worldState.config.intelligenceGrowthPerSecond = 0.004;
  worldState.config.handshakeIntelligenceBonus = 0.015;
  worldState.config.southStringencyEnabled = true;
  worldState.config.southStringencyMultiplier = 1.9;
  worldState.config.feelSpeedThreshold = Math.max(worldState.config.feelSpeedThreshold, 8);
  worldState.config.killThreshold = Math.max(worldState.config.killThreshold, 24);
  worldState.config.killSeverityThreshold = Math.max(7, worldState.config.killSeverityThreshold);
  worldState.config.stabSharpnessExponent = Math.max(1.8, worldState.config.stabSharpnessExponent);
  worldState.config.pressureTicksToKill = Math.max(90, worldState.config.pressureTicksToKill);
  worldState.config.regularizationEnabled = true;
  worldState.config.regularizationRate = Math.max(0.15, worldState.config.regularizationRate);
  worldState.config.reproductionEnabled = true;
  worldState.config.gestationTicks = 220;
  worldState.config.matingRadius = 65;
  worldState.config.conceptionChancePerTick = 0.004;
  worldState.config.maxPopulation = 550;
  worldState.config.defaultVisionAvoidDistance = Math.max(worldState.config.defaultVisionAvoidDistance, 55);
  worldState.config.defaultVisionAvoidTurnRate = Math.max(worldState.config.defaultVisionAvoidTurnRate, 2.8);
  worldState.config.peaceCryEnabled = true;
  worldState.config.defaultPeaceCryCadenceTicks = 16;
  worldState.config.defaultPeaceCryRadius = 150;
  worldState.config.sightEnabled = true;
  worldState.config.fogDensity = Math.max(worldState.config.fogDensity, 0.006);
  worldState.config.southEscapeFraction = Math.max(0.45, worldState.config.southEscapeFraction);

  const ids = [...worldState.entities].sort((a, b) => a - b);
  for (const id of ids) {
    const shape = worldState.shapes.get(id);
    const movement = worldState.movements.get(id);
    if (!shape || !movement) {
      continue;
    }

    const vision = worldState.vision.get(id);
    if (vision) {
      vision.avoidDistance = Math.max(vision.avoidDistance, 55);
      vision.avoidTurnRate = Math.max(vision.avoidTurnRate, 2.8);
    }

    const feeling = worldState.feeling.get(id);
    if (feeling) {
      feeling.enabled = true;
      feeling.feelCooldownTicks = Math.max(feeling.feelCooldownTicks, 20);
      feeling.approachSpeed = Math.min(feeling.approachSpeed, 9);
    }

    const peaceCry = worldState.peaceCry.get(id);
    if (peaceCry) {
      peaceCry.enabled = true;
      peaceCry.cadenceTicks = 16;
      peaceCry.radius = 150;
    }

    const isIsosceles =
      shape.kind === 'polygon' && shape.sides === 3 && shape.triangleKind === 'Isosceles';
    const isWoman = shape.kind === 'segment';
    const cap = isWoman ? 22 : isIsosceles ? 16 : 20;
    if (movement.type === 'straightDrift') {
      const driftScale = isWoman ? 0.75 : isIsosceles ? 0.65 : 0.8;
      movement.vx *= driftScale;
      movement.vy *= driftScale;
      continue;
    }

    movement.speed = Math.min(movement.speed, cap);
  }
}

function applyNovelSafetyPresetToPlan(plan: SpawnRequest[]): SpawnRequest[] {
  return plan.map((request) => {
    const shape = request.shape;
    const movement = request.movement;
    const isIsosceles =
      shape.kind === 'polygon' && shape.sides === 3 && shape.triangleKind === 'Isosceles';
    const isWoman = shape.kind === 'segment';
    const cap = isWoman ? 22 : isIsosceles ? 16 : 20;

    const adjustedMovement: SpawnMovementConfig =
      movement.type === 'straightDrift'
        ? {
            ...movement,
            vx: movement.vx * (isWoman ? 0.75 : isIsosceles ? 0.65 : 0.8),
            vy: movement.vy * (isWoman ? 0.75 : isIsosceles ? 0.65 : 0.8),
          }
        : {
            ...movement,
            speed: Math.min(movement.speed, cap),
          };

    return {
      ...request,
      movement: adjustedMovement,
      feeling: {
        enabled: request.feeling?.enabled ?? true,
        feelCooldownTicks: Math.max(20, request.feeling?.feelCooldownTicks ?? 20),
        approachSpeed: Math.min(9, request.feeling?.approachSpeed ?? 9),
      },
    };
  });
}
