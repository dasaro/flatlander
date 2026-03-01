import './styles.css';

import type { BoundaryMode, MovementComponent } from './core/components';
import { computeDefaultEyeComponent, eyePoseWorld } from './core/eyePose';
import type { WorldEvent } from './core/events';
import { countLivingDescendants, getAncestors } from './core/genealogy';
import { Rank } from './core/rank';
import type { EventType } from './ui/eventAnalytics';
import { EventAnalytics } from './ui/eventAnalytics';
import { spawnFromRequest, type SpawnMovementConfig, type SpawnRequest } from './core/factory';
import { requestStillness } from './core/stillness';
import { FixedTimestepSimulation } from './core/simulation';
import { boundaryFromTopology, type WorldTopology } from './core/topology';
import { createWorld, type WorldConfig } from './core/world';
import { spawnHouses } from './core/worldgen/houses';
import { applySpawnPlan as applyScenarioSpawnPlan, defaultSpawnPlan } from './presets/defaultScenario';
import { fogDensityAt } from './core/fogField';
import type { Vec2 } from './geometry/vector';
import { Camera } from './render/camera';
import { CanvasRenderer } from './render/canvasRenderer';
import { EffectsManager } from './render/effects';
import { EventTimelineRenderer } from './render/eventTimelineRenderer';
import {
  normalizedXFromClientX,
  pickFlatlanderSampleAtNormalizedX,
} from './render/flatlanderPicking';
import { computeFlatlanderScan, type FlatlanderScanResult } from './render/flatlanderScan';
import { FlatlanderViewRenderer } from './render/flatlanderViewRenderer';
import { PopulationHistogram } from './render/populationHistogram';
import { HearingSystem } from './systems/hearingSystem';
import { PeaceCrySystem } from './systems/peaceCrySystem';
import { RainSystem } from './systems/rainSystem';
import { CleanupSystem } from './systems/cleanupSystem';
import { CollisionSystem } from './systems/collisionSystem';
import { ErosionSystem } from './systems/erosionSystem';
import { AgeDeteriorationSystem } from './systems/ageDeteriorationSystem';
import { FeelingApproachSystem } from './systems/feelingApproachSystem';
import { FeelingSystem } from './systems/feelingSystem';
import { HouseSystem } from './systems/houseSystem';
import { IntelligenceGrowthSystem } from './systems/intelligenceGrowthSystem';
import {
  IntroductionIntentSystem,
  requestIntroductionWithNearestUnknown,
} from './systems/introductionIntentSystem';
import { LethalitySystem } from './systems/lethalitySystem';
import { CollisionResolutionSystem } from './systems/collisionResolutionSystem';
import { AvoidanceSteeringSystem } from './systems/avoidanceSteeringSystem';
import { MovementSystem } from './systems/movementSystem';
import { ReproductionSystem } from './systems/reproductionSystem';
import { NeoTherapySystem } from './systems/neoTherapySystem';
import { SocialNavMindSystem } from './systems/socialNavMindSystem';
import { SocialNavSteeringSystem } from './systems/socialNavSteeringSystem';
import { SouthAttractionSystem } from './systems/southAttractionSystem';
import { StillnessControllerSystem } from './systems/stillnessControllerSystem';
import { SleepSystem } from './systems/sleepSystem';
import { SwaySystem } from './systems/swaySystem';
import { VisionSystem } from './systems/visionSystem';
import { CompensationSystem } from './systems/compensationSystem';
import { RegularizationSystem } from './systems/regularizationSystem';
import { CrowdStressSystem } from './systems/crowdStressSystem';
import { PickingController } from './ui/pickingController';
import { SelectionState } from './ui/selectionState';
import { getVisibleLegendItems, type LegendVisibilityState } from './ui/legendModel';
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
import { MobileMenuState } from './ui/mobileMenuState';
import { EventDrainPipeline } from './ui/eventDrainPipeline';
import { captureFrameSnapshot, type FrameSnapshot } from './ui/frameSnapshot';
import { RainTimelineStore } from './ui/rainTimelineStore';
import { APP_VERSION } from './version';

const TIMELINE_TYPE_CONTROL_IDS: Partial<Record<EventType, string>> = {
  handshakeAttemptFailed: 'timeline-type-handshake-failed',
  handshake: 'timeline-type-handshake',
  houseEnter: 'timeline-type-house-enter',
  houseExit: 'timeline-type-house-exit',
  death: 'timeline-type-death',
  birth: 'timeline-type-birth',
  regularized: 'timeline-type-regularized',
};

const canvas = document.getElementById('world-canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #world-canvas canvas element.');
}
const histogramCanvas = document.getElementById('population-histogram');
if (!(histogramCanvas instanceof HTMLCanvasElement)) {
  throw new Error('Missing #population-histogram canvas element.');
}
const eventTimelineCanvas = document.getElementById('event-timeline-canvas');
const eventTimelineTooltip = document.getElementById('event-timeline-tooltip');
const eventTimelineLegend = document.getElementById('event-timeline-legend');
const legendList = document.getElementById('legend-list');
const legendEmptyHint = document.getElementById('legend-empty-hint');
const populationTooltip = document.getElementById('population-histogram-tooltip');
const populationClearSelectionButton = document.getElementById('population-clear-selection');
const hasEventTimelineUi =
  eventTimelineCanvas instanceof HTMLCanvasElement &&
  eventTimelineTooltip instanceof HTMLElement &&
  eventTimelineLegend instanceof HTMLElement;
const flatlanderCanvasNode = document.getElementById('flatlander-canvas');
if (!(flatlanderCanvasNode instanceof HTMLCanvasElement)) {
  throw new Error('Missing #flatlander-canvas canvas element.');
}
const flatlanderCanvas: HTMLCanvasElement = flatlanderCanvasNode;
const worldHoverInfo = document.getElementById('world-hover-info');

const initialSeedInput = document.getElementById('seed-input');
if (!(initialSeedInput instanceof HTMLInputElement)) {
  throw new Error('Missing #seed-input input element.');
}
const topologyInput = document.getElementById('world-topology');
if (!(topologyInput instanceof HTMLSelectElement)) {
  throw new Error('Missing #world-topology select element.');
}
const versionBadge = document.getElementById('app-version-badge');
const quickRunBtn = document.getElementById('quick-run-btn');
const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
const sidebar = document.getElementById('sidebar');
const mobileMenuBackdrop = document.getElementById('mobile-menu-backdrop');
const primaryRunBtn = document.getElementById('run-btn');

const systems = [
  new PeaceCrySystem(),
  new RainSystem(),
  new HearingSystem(),
  new VisionSystem(),
  new SocialNavMindSystem(),
  new FeelingApproachSystem(),
  new IntroductionIntentSystem(),
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

let worldTopology: WorldTopology = topologyInput.value === 'bounded' ? 'bounded' : 'torus';
const initialBoundary = boundaryFromTopology(worldTopology);
let spawnPlan: SpawnRequest[] = defaultSpawnPlan(initialBoundary);
let environmentSettings: EnvironmentSettings = {
  housesEnabled: true,
  houseCount: 8,
  townPopulation: 5000,
  allowTriangularForts: false,
  allowSquareHouses: false,
  houseSize: 30,
  rainEnabled: true,
  showRainOverlay: true,
  showFogOverlay: true,
  showDoors: true,
  showOccupancy: true,
  showHousingDebug: false,
};
let peaceCrySettings: PeaceCrySettings = {
  enabled: true,
  cadenceTicks: 20,
  radius: 120,
};
let reproductionSettings: ReproductionSettings = {
  enabled: true,
  gestationTicks: 130,
  matingRadius: 52,
  conceptionChancePerTick: 0.02,
  femaleBirthProbability: 0.52,
  maxPopulation: 650,
  irregularBirthsEnabled: true,
  irregularBirthBaseChance: 0.14,
};
let eventHighlightsSettings: EventHighlightsSettings = {
  enabled: true,
  intensity: 1,
  capPerTick: 120,
  showFeeling: true,
  focusOnSelected: false,
  showHearingOverlay: true,
  showTalkingOverlay: false,
  strokeByKills: false,
  showContactNetwork: true,
  networkShowParents: true,
  networkShowKnown: true,
  networkMaxKnownEdges: 25,
  networkShowOnlyOnScreen: true,
  networkFocusRadius: 400,
  dimByAge: true,
  dimByDeterioration: true,
  dimStrength: 0.55,
  fogPreviewEnabled: true,
  fogPreviewStrength: 0.5,
  fogPreviewHideBelowMin: false,
  fogPreviewRings: true,
  showEyes: true,
  showPovCone: false,
};
let flatlanderViewSettings: FlatlanderViewSettings = {
  enabled: true,
  rays: 720,
  fovRad: Math.PI,
  lookOffsetRad: 0,
  maxDistance: 400,
  fogDensity: 0.012,
  minVisibleIntensity: 0.06,
  grayscaleMode: true,
  includeObstacles: true,
  includeBoundaries: true,
  inanimateDimMultiplier: 0.65,
};
let fogSightSettings: FogSightSettings = {
  sightEnabled: true,
  fogDensity: 0.012,
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
populateWorld(world, spawnPlan);

const simulation = new FixedTimestepSimulation(world, systems);
const renderer = new CanvasRenderer(canvas, world.config.width, world.config.height);
renderer.setAppVersion(APP_VERSION);
const effectsManager = new EffectsManager();
effectsManager.setSettings(eventHighlightsSettings);
const flatlanderViewRenderer = new FlatlanderViewRenderer(flatlanderCanvas);
const populationHistogram =
  populationTooltip instanceof HTMLElement
    ? new PopulationHistogram(histogramCanvas, populationTooltip)
    : new PopulationHistogram(histogramCanvas);
const eventAnalytics = new EventAnalytics(Number.POSITIVE_INFINITY);
const eventTimelineRenderer = hasEventTimelineUi
  ? new EventTimelineRenderer(eventTimelineCanvas, eventTimelineTooltip)
  : null;
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
let flatlanderHoverEntityId: number | null = null;
let flatlanderHoverSampleIndex: number | null = null;
let flatlanderHoverNormalizedX: number | null = null;
let hoveredWorldEntityId: number | null = null;
let hoveredWorldPoint: Vec2 | null = null;
let hoveredWorldClientPoint: Vec2 | null = null;
const eventDrainPipeline = new EventDrainPipeline(
  world.tick,
  () => world.events.drain(),
  [
    (events) => effectsManager.ingest(events),
    (events) => eventAnalytics.ingest(events),
    (events) => recordLegendEvents(events),
  ],
);
const rainTimeline = new RainTimelineStore();

const selectedTimelineTypes = readSelectedTimelineTypes();
const selectedTimelineRanks = readSelectedTimelineRankKeys();
let timelineSplitByRank = readCheckbox('timeline-split-by-rank');
let timelineShowLegend = readCheckbox('timeline-show-legend');
let lastLegendSignature = '';
const recentLegendEvents: Array<{ tick: number; type: EventType }> = [];

document.title = `Flatlander ${APP_VERSION}`;
if (versionBadge instanceof HTMLElement) {
  versionBadge.textContent = `v${APP_VERSION}`;
}
if (
  sidebarToggleBtn instanceof HTMLButtonElement &&
  sidebar instanceof HTMLElement &&
  mobileMenuBackdrop instanceof HTMLElement
) {
  initializeMobileMenu(sidebarToggleBtn, sidebar, mobileMenuBackdrop);
}
if (quickRunBtn instanceof HTMLButtonElement && primaryRunBtn instanceof HTMLButtonElement) {
  syncQuickRunButton(quickRunBtn, primaryRunBtn);
  quickRunBtn.addEventListener('click', () => {
    primaryRunBtn.click();
    syncQuickRunButton(quickRunBtn, primaryRunBtn);
  });
}
initializePanelCollapsers();
wireTimelineControls();

const ui = new UIController({
  onToggleRun: () => simulation.toggleRunning(),
  onStep: () => {
    simulation.stepOneTick();
    processTickEvents();
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
    populateWorld(world, spawnPlan);
    simulation.setWorld(world);
    effectsManager.clear();
    eventAnalytics.clear();
    populationHistogram.reset(world);
    eventDrainPipeline.reset(world.tick);
    rainTimeline.reset();
    recentLegendEvents.length = 0;
    lastLegendSignature = '';
    selectionState.setSelected(null);
    camera.reset(world.config.width, world.config.height);
    cachedFlatlanderScan = null;
    flatlanderScanDirty = true;
    lastFlatlanderScanTick = -1;
    lastFlatlanderScanViewerId = null;
    lastFlatlanderScanConfigKey = '';
    clearFlatlanderHover();
    hoveredWorldEntityId = null;
    hoveredWorldPoint = null;
    hoveredWorldClientPoint = null;
    debugClickPoint = null;
    lastRenderTimeMs = 0;
    renderSelection();
  },
  onSimulationSpeedUpdate: (scale) => {
    simulation.setTimeScale(scale);
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
    environmentSettings = settings;
    applyEnvironmentSettingsToWorld(world, environmentSettings);
    flatlanderScanDirty = true;
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
  onApplyHarmonicMotionPreset: () => {
    applyHarmonicMotionPreset(world);
    spawnPlan = applyHarmonicMotionPresetToPlan(spawnPlan);
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
  onInspectorEyeUpdate: (eyeConfig) => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null) {
      return;
    }

    const shape = world.shapes.get(selectedId);
    if (!shape) {
      return;
    }

    const current = world.eyes.get(selectedId) ?? computeDefaultEyeComponent(shape, world.config.defaultEyeFovDeg);
    const clampedFovDeg = Math.max(60, Math.min(300, eyeConfig.fovDeg));
    world.eyes.set(selectedId, {
      ...current,
      fovRad: (clampedFovDeg * Math.PI) / 180,
    });
    flatlanderScanDirty = true;
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
  onInspectorToggleManualStillness: () => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null || !world.entities.has(selectedId)) {
      return;
    }

    const current = world.stillness.get(selectedId);
    if (current?.reason === 'manual') {
      world.stillness.delete(selectedId);
    } else {
      requestStillness(world, {
        entityId: selectedId,
        mode: 'full',
        reason: 'manual',
        ticksRemaining: 120,
        requestedBy: null,
      });
    }
    renderSelection();
  },
  onInspectorRequestIntroduction: () => {
    const selectedId = selectionState.selectedId;
    if (selectedId === null || !world.entities.has(selectedId)) {
      return;
    }
    requestIntroductionWithNearestUnknown(world, selectedId);
    renderSelection();
  },
});

if (populationClearSelectionButton instanceof HTMLButtonElement) {
  populationClearSelectionButton.addEventListener('click', () => {
    populationHistogram.clearSelection();
  });
}

selectionState.subscribe(() => {
  flatlanderScanDirty = true;
  clearFlatlanderHover();
  hoveredWorldEntityId = null;
  hoveredWorldPoint = null;
  hoveredWorldClientPoint = null;
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
  onHoverApplied: (hoveredId, pointWorld, clientPoint) => {
    hoveredWorldEntityId = hoveredId;
    hoveredWorldPoint = pointWorld;
    hoveredWorldClientPoint = clientPoint;
  },
  tolerancePx: 10,
  dragThresholdPx: 7,
});
pickingController.attach();
flatlanderCanvas.addEventListener('pointermove', (event) => {
  updateFlatlanderHoverPointer(event.clientX);
});
flatlanderCanvas.addEventListener('pointerleave', () => {
  clearFlatlanderHover();
});

function frame(now: number): void {
  const dtVisualSeconds = lastRenderTimeMs === 0 ? 0 : Math.max(0, Math.min(0.25, (now - lastRenderTimeMs) / 1000));
  lastRenderTimeMs = now;

  simulation.frame(now);
  processTickEvents();
  effectsManager.update(dtVisualSeconds);
  populationHistogram.record(world);
  ensureSelectionStillAlive();
  if (flatlanderHoverEntityId !== null && !world.entities.has(flatlanderHoverEntityId)) {
    setFlatlanderHover(null, null);
  }

  const frameSnapshot = captureFrameSnapshot(world, {
    showRainOverlay: environmentSettings.showRainOverlay,
    showFogOverlay: environmentSettings.showFogOverlay,
  });
  rainTimeline.record(frameSnapshot.tick, frameSnapshot.isRaining);
  const clickPoint = debugClickPoint;
  debugClickPoint = null;

  renderFlatlanderView(frameSnapshot);
  renderer.render(world, camera, selectionState.selectedId, frameSnapshot, {
    showSouthZoneOverlay: southAttractionSettings.showSouthZoneOverlay,
    debugClickPoint: southAttractionSettings.showClickDebug ? clickPoint : null,
    effectsManager,
    strokeByKills: eventHighlightsSettings.strokeByKills,
    showHearingOverlay: eventHighlightsSettings.showHearingOverlay,
    showTalkingOverlay: eventHighlightsSettings.showTalkingOverlay,
    showContactNetwork: eventHighlightsSettings.showContactNetwork,
    networkShowParents: eventHighlightsSettings.networkShowParents,
    networkShowKnown: eventHighlightsSettings.networkShowKnown,
    networkMaxKnownEdges: eventHighlightsSettings.networkMaxKnownEdges,
    networkShowOnlyOnScreen: eventHighlightsSettings.networkShowOnlyOnScreen,
    networkFocusRadius: eventHighlightsSettings.networkFocusRadius,
    dimByAge: eventHighlightsSettings.dimByAge,
    dimByDeterioration: eventHighlightsSettings.dimByDeterioration,
    dimStrength: eventHighlightsSettings.dimStrength,
    fogPreviewEnabled: eventHighlightsSettings.fogPreviewEnabled,
    fogPreviewStrength: eventHighlightsSettings.fogPreviewStrength,
    fogPreviewHideBelowMin: eventHighlightsSettings.fogPreviewHideBelowMin,
    fogPreviewRings: eventHighlightsSettings.fogPreviewRings,
    showEyes: eventHighlightsSettings.showEyes,
    showPovCone: eventHighlightsSettings.showPovCone,
    showStillnessCues: eventHighlightsSettings.showFeeling,
    flatlanderHoverEntityId,
    showHouseDoors: environmentSettings.showDoors,
    showHouseOccupancy: environmentSettings.showOccupancy,
    showHousingDebug: environmentSettings.showHousingDebug,
  });
  populationHistogram.render();
  renderEventTimeline();
  renderDynamicLegend();
  renderWorldHoverInfo();
  ui.renderStats(world);
  if (quickRunBtn instanceof HTMLButtonElement && primaryRunBtn instanceof HTMLButtonElement) {
    syncQuickRunButton(quickRunBtn, primaryRunBtn);
  }
  requestAnimationFrame(frame);
}

renderSelection();
requestAnimationFrame(frame);

function renderSelection(): void {
  const selectedId = selectionState.selectedId;
  if (selectedId === null) {
    renderNoSelectionInspector();
    return;
  }

  const selectedHouse = world.houses.get(selectedId) ?? null;
  if (selectedHouse) {
    const occupants = [...(world.houseOccupants.get(selectedId) ?? new Set<number>())]
      .sort((a, b) => a - b)
      .map((occupantId) => ({
        id: occupantId,
        rankLabel: rankLabelForEntity(occupantId),
      }));
    const selectedShape = world.shapes.get(selectedId);
    const shapeLabel =
      selectedShape?.kind === 'polygon'
        ? `${selectedShape.sides}-gon house`
        : selectedShape
          ? selectedShape.kind
          : 'House';
    ui.renderSelectedHouse(selectedId, selectedHouse.houseKind, shapeLabel, occupants);
    return;
  }

  const movement = world.movements.get(selectedId) ?? null;
  const shape = world.shapes.get(selectedId) ?? null;
  const rank = world.ranks.get(selectedId) ?? null;
  const job = world.jobs.get(selectedId)?.job ?? null;
  const vision = world.vision.get(selectedId) ?? null;
  const perception = world.perceptions.get(selectedId) ?? null;
  const eyePose = eyePoseWorld(world, selectedId);
  const eyeForwardDeg =
    eyePose === null
      ? null
      : (((Math.atan2(eyePose.forwardWorld.y, eyePose.forwardWorld.x) * 180) / Math.PI) + 360) % 360;
  const eyeFovDeg = eyePose === null ? null : (eyePose.fovRad * 180) / Math.PI;
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
  const lineage = world.lineage.get(selectedId) ?? null;
  const legacy = world.legacy.get(selectedId) ?? null;
  const durability = world.durability.get(selectedId) ?? null;
  const stillness = world.stillness.get(selectedId) ?? null;
  const selectedName = world.names.get(selectedId)?.displayName ?? null;
  const ancestorEntries = getAncestors(world, selectedId, 4);
  const ancestorsLabel =
    ancestorEntries.length > 0
      ? ancestorEntries
          .slice(0, 6)
          .map((entry) => `${entry.relation}:${entry.id}`)
          .join(', ')
      : 'None';

  if (legacy) {
    legacy.descendantsAlive = countLivingDescendants(world, selectedId);
  }
  if (!movement || !shape || !rank || !vision || !perception || !voice || !feeling || !knowledge) {
    selectionState.setSelected(null);
    renderNoSelectionInspector();
    return;
  }

  ui.renderSelected(
    selectedId,
    selectedName,
    movement,
    shape,
    rank,
    job,
    vision,
    perception,
    eyePose?.eyeWorld ?? null,
    eyeForwardDeg,
    eyeFovDeg,
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
    lineage,
    legacy,
    durability,
    stillness,
    ancestorsLabel,
  );
  ui.renderDwellingState(world.dwellings.get(selectedId) ?? null);
}

function renderNoSelectionInspector(): void {
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
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'N/A',
  );
  ui.renderDwellingState(null);
}

function renderWorldHoverInfo(): void {
  if (!(worldHoverInfo instanceof HTMLElement)) {
    return;
  }

  if (
    hoveredWorldEntityId === null ||
    !world.entities.has(hoveredWorldEntityId) ||
    hoveredWorldClientPoint === null
  ) {
    worldHoverInfo.hidden = true;
    return;
  }

  const entityId = hoveredWorldEntityId;
  const house = world.houses.get(entityId);
  const shape = world.shapes.get(entityId);
  const rankLabel = rankLabelForEntity(entityId);
  const movement = world.movements.get(entityId);
  const job = world.jobs.get(entityId)?.job ?? null;
  const age = world.ages.get(entityId);
  const combat = world.combatStats.get(entityId);
  const feeling = world.feeling.get(entityId);
  const speed =
    movement?.type === 'straightDrift'
      ? Math.hypot(movement.vx, movement.vy)
      : movement
        ? movement.speed
        : 0;

  let shapeLabel = 'Unknown';
  if (house) {
    shapeLabel = `${house.houseKind} House`;
  } else if (shape?.kind === 'segment') {
    shapeLabel = 'Woman Segment';
  } else if (shape?.kind === 'circle') {
    shapeLabel = 'Circle';
  } else if (shape?.kind === 'polygon') {
    shapeLabel =
      shape.sides === 3 && shape.triangleKind
        ? `${shape.sides}-gon (${shape.triangleKind})`
        : `${shape.sides}-gon`;
  }

  const displayName = world.names.get(entityId)?.displayName;
  const title = displayName
    ? `${displayName} (#${entityId}) · ${rankLabel}`
    : `#${entityId} · ${rankLabel}`;
  const lines = house
    ? [
        `${shapeLabel}`,
        `Occupants: ${world.houseOccupants.get(entityId)?.size ?? 0}`,
        hoveredWorldPoint
          ? `x ${hoveredWorldPoint.x.toFixed(1)} · y ${hoveredWorldPoint.y.toFixed(1)}`
          : '',
      ]
    : [
        `${shapeLabel} · ${movementLabel(movement)}`,
        `Speed ${speed.toFixed(1)} · Kills ${combat?.kills ?? 0} · Age ${age?.ticksAlive ?? 0}`,
        ...(job ? [`Job ${job}`] : []),
        `Feeling ${feeling?.state ?? 'N/A'}`,
      ];

  worldHoverInfo.innerHTML = [
    `<div class="world-hover-title">${title}</div>`,
    ...lines.filter((line) => line.length > 0).map((line) => `<div>${line}</div>`),
  ].join('');

  const offset = 14;
  worldHoverInfo.style.left = `${hoveredWorldClientPoint.x + offset}px`;
  worldHoverInfo.style.top = `${hoveredWorldClientPoint.y + offset}px`;
  worldHoverInfo.hidden = false;
}

function movementLabel(movement: MovementComponent | undefined): string {
  if (!movement) {
    return 'Static';
  }
  switch (movement.type) {
    case 'straightDrift':
      return 'Straight Drift';
    case 'seekPoint':
      return 'Seek Point';
    case 'socialNav':
      return `SocialNav (${movement.intention})`;
    case 'randomWalk':
    default:
      return 'Random Walk';
  }
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
    settings.includeBoundaries ? '1' : '0',
    settings.inanimateDimMultiplier.toFixed(3),
  ].join('|');
}

function renderFlatlanderView(frameSnapshot: Readonly<FrameSnapshot>): void {
  if (!flatlanderViewSettings.enabled) {
    clearFlatlanderHover();
    flatlanderViewRenderer.clearWithMessage('Flatlander view disabled');
    return;
  }

  const selectedId = selectionState.selectedId;
  if (selectedId === null) {
    clearFlatlanderHover();
    flatlanderViewRenderer.clearWithMessage('Select an entity');
    return;
  }

  if (!world.entities.has(selectedId)) {
    clearFlatlanderHover();
    flatlanderViewRenderer.clearWithMessage('Selected entity removed');
    return;
  }

  const transform = world.transforms.get(selectedId);
  if (!transform) {
    clearFlatlanderHover();
    flatlanderViewRenderer.clearWithMessage('No transform for selection');
    return;
  }
  const selectedEyePose = eyePoseWorld(world, selectedId);
  if (!selectedEyePose) {
    clearFlatlanderHover();
    flatlanderViewRenderer.clearWithMessage('No eye pose for selection');
    return;
  }

  const configKey = flatlanderConfigKey(flatlanderViewSettings);
  const baseFog = Math.max(1e-6, world.config.fogDensity);
  const localFog = fogDensityAt(frameSnapshot.fogField, selectedEyePose.eyeWorld);
  const effectiveFlatlanderSettings: FlatlanderViewSettings = {
    ...flatlanderViewSettings,
    fogDensity: flatlanderViewSettings.fogDensity * (localFog / baseFog),
  };
  if (
    flatlanderScanDirty ||
    world.tick !== lastFlatlanderScanTick ||
    selectedId !== lastFlatlanderScanViewerId ||
    configKey !== lastFlatlanderScanConfigKey
  ) {
    cachedFlatlanderScan = computeFlatlanderScan(world, selectedId, effectiveFlatlanderSettings);
    lastFlatlanderScanTick = world.tick;
    lastFlatlanderScanViewerId = selectedId;
    lastFlatlanderScanConfigKey = configKey;
    flatlanderScanDirty = false;
  }

  if (!cachedFlatlanderScan) {
    clearFlatlanderHover();
    flatlanderViewRenderer.clearWithMessage('No scan');
    return;
  }
  syncFlatlanderHoverFromScan(cachedFlatlanderScan);

  flatlanderViewRenderer.render(
    cachedFlatlanderScan,
    effectiveFlatlanderSettings,
    Math.atan2(selectedEyePose.forwardWorld.y, selectedEyePose.forwardWorld.x) +
      effectiveFlatlanderSettings.lookOffsetRad,
    flatlanderHoverEntityId,
    flatlanderHoverSampleIndex,
    {
      isRaining: frameSnapshot.isRaining,
      tick: frameSnapshot.tick,
    },
  );
}

function setFlatlanderHover(entityId: number | null, sampleIndex: number | null): void {
  flatlanderHoverEntityId = entityId;
  flatlanderHoverSampleIndex = sampleIndex;
  flatlanderCanvas.style.cursor = entityId !== null ? 'pointer' : 'default';
}

function clearFlatlanderHover(): void {
  flatlanderHoverNormalizedX = null;
  setFlatlanderHover(null, null);
}

function updateFlatlanderHoverPointer(clientX: number): void {
  if (!flatlanderViewSettings.enabled || selectionState.selectedId === null) {
    clearFlatlanderHover();
    return;
  }

  const rect = flatlanderCanvas.getBoundingClientRect();
  const normalizedX = normalizedXFromClientX(clientX, rect.left, rect.width);
  if (normalizedX === null) {
    clearFlatlanderHover();
    return;
  }
  flatlanderHoverNormalizedX = normalizedX;
  if (cachedFlatlanderScan) {
    syncFlatlanderHoverFromScan(cachedFlatlanderScan);
  }
}

function syncFlatlanderHoverFromScan(scan: FlatlanderScanResult): void {
  if (flatlanderHoverNormalizedX === null) {
    setFlatlanderHover(null, null);
    return;
  }

  const pick = pickFlatlanderSampleAtNormalizedX(scan.samples, flatlanderHoverNormalizedX);
  if (!pick || pick.hitId === null || pick.hitId < 0 || !world.entities.has(pick.hitId)) {
    setFlatlanderHover(null, pick?.sampleIndex ?? null);
    return;
  }

  setFlatlanderHover(pick.hitId, pick.sampleIndex);
}

function processTickEvents(): void {
  eventDrainPipeline.processForTick(world.tick);
}

function renderEventTimeline(): void {
  if (!eventTimelineRenderer || !(eventTimelineLegend instanceof HTMLElement)) {
    return;
  }
  syncDynamicRankFilters();
  const selectedTypes = readSelectedTimelineTypes();
  const selectedRanks = readSelectedTimelineRankKeys();
  const focusId =
    eventHighlightsSettings.focusOnSelected && selectionState.selectedId !== null
      ? selectionState.selectedId
      : null;
  const summaries = eventAnalytics.getFilteredSummaries({
    selectedTypes,
    selectedRankKeys: selectedRanks,
    splitByRank: timelineSplitByRank,
    focusEntityId: focusId,
  });

  eventTimelineRenderer.render(summaries, {
    splitByRank: timelineSplitByRank,
    selectedTypes: [...selectedTypes],
    selectedRankKeys: [...selectedRanks],
    showLegend: timelineShowLegend,
    tickStart: 0,
    tickEnd: world.tick,
    showRainTrack: world.config.rainEnabled && world.config.housesEnabled,
    rainIntervals: rainTimeline.getIntervals(world.tick),
  });
  eventTimelineLegend.hidden = !timelineShowLegend;
}

function recordLegendEvents(events: WorldEvent[]): void {
  if (events.length === 0) {
    return;
  }
  for (const event of events) {
    recentLegendEvents.push({ tick: event.tick, type: event.type });
  }
}

function observedLegendEventTypes(currentTick: number): Set<EventType> {
  const minTick = Math.max(0, currentTick - 5_000);
  while (recentLegendEvents.length > 0 && recentLegendEvents[0] && recentLegendEvents[0].tick < minTick) {
    recentLegendEvents.shift();
  }
  const observed = new Set<EventType>();
  for (const record of recentLegendEvents) {
    observed.add(record.type);
  }
  return observed;
}

function renderDynamicLegend(): void {
  if (!(legendList instanceof HTMLElement)) {
    return;
  }

  const state: LegendVisibilityState = {
    eventHighlightsEnabled: eventHighlightsSettings.enabled,
    showFeeling: eventHighlightsSettings.showFeeling,
    showHearingOverlay: eventHighlightsSettings.showHearingOverlay,
    showContactNetwork: eventHighlightsSettings.showContactNetwork,
    showNetworkParents: eventHighlightsSettings.networkShowParents,
    showNetworkKnown: eventHighlightsSettings.networkShowKnown,
    observedEventTypes: observedLegendEventTypes(world.tick),
    hasSelectedEntity: selectionState.selectedId !== null && world.entities.has(selectionState.selectedId),
    hasAnyStillness: world.stillness.size > 0,
  };

  const items = getVisibleLegendItems(state);
  const signature = items.map((item) => item.id).join('|');
  if (signature === lastLegendSignature) {
    if (legendEmptyHint instanceof HTMLElement) {
      legendEmptyHint.hidden = items.length > 0;
    }
    return;
  }
  lastLegendSignature = signature;
  legendList.innerHTML = '';

  for (const item of items) {
    const row = document.createElement('li');
    const icon = document.createElement('canvas');
    icon.width = 22;
    icon.height = 22;
    const ctx = icon.getContext('2d');
    if (ctx) {
      item.drawIcon(ctx, 22);
    }
    const label = document.createElement('span');
    label.textContent = item.label;
    row.append(icon, label);
    legendList.appendChild(row);
  }

  if (legendEmptyHint instanceof HTMLElement) {
    legendEmptyHint.hidden = items.length > 0;
  }
}

function readInitialSeed(raw: string): number {
  const seed = Number.parseInt(raw, 10);
  return Number.isFinite(seed) ? seed : 1;
}

function rankLabelForEntity(entityId: number): string {
  const rank = world.ranks.get(entityId);
  const shape = world.shapes.get(entityId);
  if (!rank || !shape) {
    return 'Unknown';
  }
  if (rank.rank === Rank.Triangle && shape.kind === 'polygon') {
    return shape.triangleKind === 'Isosceles' ? 'Triangle (Isosceles)' : 'Triangle (Equilateral)';
  }
  return rank.rank;
}

function populateWorld(targetWorld: typeof world, plan: SpawnRequest[]): void {
  spawnHouses(targetWorld, targetWorld.rng, targetWorld.config);
  applyScenarioSpawnPlan(targetWorld, plan);
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

  if (update.type === 'socialNav') {
    const maxSpeed = Math.max(0.1, update.maxSpeed);
    const maxTurnRate = Math.max(0.1, update.maxTurnRate);
    return {
      type: 'socialNav',
      boundary,
      heading: inheritedHeading,
      speed: current.type === 'straightDrift' ? maxSpeed * 0.75 : Math.min(maxSpeed, current.speed),
      turnRate: maxTurnRate,
      maxSpeed,
      maxTurnRate,
      decisionEveryTicks: Math.max(1, Math.round(update.decisionEveryTicks)),
      intentionMinTicks: Math.max(1, Math.round(update.intentionMinTicks)),
      intention: current.type === 'socialNav' ? current.intention : 'roam',
      intentionTicksLeft:
        current.type === 'socialNav'
          ? Math.max(1, current.intentionTicksLeft)
          : Math.max(1, Math.round(update.intentionMinTicks)),
      smoothHeading: current.type === 'socialNav' ? current.smoothHeading : inheritedHeading,
      smoothSpeed:
        current.type === 'socialNav' ? Math.min(maxSpeed, current.smoothSpeed) : Math.min(maxSpeed, maxSpeed * 0.75),
      ...(current.type === 'socialNav' && current.goal ? { goal: current.goal } : {}),
    };
  }

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
    houseCount: Math.max(0, Math.round(environment.houseCount)),
    townPopulation: Math.max(0, Math.round(environment.townPopulation)),
    allowTriangularForts: environment.allowTriangularForts,
    allowSquareHouses: environment.allowSquareHouses,
    houseSize: Math.max(4, environment.houseSize),
    houseMinSpacing: Math.max(0, Math.round(environment.houseSize * 0.35)),
    rainEnabled: environment.rainEnabled && environment.housesEnabled,
    peaceCryEnabled: peaceCry.enabled,
    defaultPeaceCryCadenceTicks: peaceCry.cadenceTicks,
    defaultPeaceCryRadius: peaceCry.radius,
    reproductionEnabled: reproduction.enabled,
    gestationTicks: reproduction.gestationTicks,
    matingRadius: reproduction.matingRadius,
    conceptionChancePerTick: reproduction.conceptionChancePerTick,
    femaleBirthProbability: reproduction.femaleBirthProbability,
    maxPopulation: reproduction.maxPopulation,
    irregularBirthsEnabled: reproduction.irregularBirthsEnabled,
    irregularBirthBaseChance: reproduction.irregularBirthBaseChance,
    irregularBirthChance: reproduction.irregularBirthBaseChance,
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

function applyEnvironmentSettingsToWorld(
  worldState: typeof world,
  environment: EnvironmentSettings,
): void {
  worldState.config.housesEnabled = environment.housesEnabled;
  worldState.config.houseCount = Math.max(0, Math.round(environment.houseCount));
  worldState.config.townPopulation = Math.max(0, Math.round(environment.townPopulation));
  worldState.config.allowTriangularForts = environment.allowTriangularForts;
  worldState.config.allowSquareHouses = environment.allowSquareHouses;
  worldState.config.houseSize = Math.max(4, environment.houseSize);
  worldState.config.houseMinSpacing = Math.max(0, Math.round(environment.houseSize * 0.35));
  worldState.config.rainEnabled = environment.rainEnabled && environment.housesEnabled;
  if (!worldState.config.rainEnabled) {
    worldState.weather.isRaining = false;
    worldState.weather.ticksUntilRain = Math.max(1, Math.round(worldState.config.rainBasePeriodTicks));
    worldState.weather.ticksRemainingRain = Math.max(1, Math.round(worldState.config.rainBaseDurationTicks));
  }
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
  worldState.config.irregularBirthsEnabled = settings.irregularBirthsEnabled;
  worldState.config.irregularBirthBaseChance = Math.max(0, Math.min(1, settings.irregularBirthBaseChance));
  worldState.config.irregularBirthChance = worldState.config.irregularBirthBaseChance;
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
  worldState.config.compensationEnabled = false;
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
  worldState.config.conceptionChancePerTick = 0.0042;
  worldState.config.femaleBirthProbability = 0.56;
  worldState.config.maleBirthHighRankPenaltyPerSide = 0.085;
  worldState.config.conceptionHighRankPenaltyPerSide = 0.13;
  worldState.config.maxPopulation = 550;
  worldState.config.irregularBirthsEnabled = true;
  worldState.config.irregularBirthBaseChance = 0.14;
  worldState.config.irregularBirthChance = 0.14;
  worldState.config.defaultVisionAvoidDistance = Math.max(worldState.config.defaultVisionAvoidDistance, 55);
  worldState.config.defaultVisionAvoidTurnRate = Math.max(worldState.config.defaultVisionAvoidTurnRate, 2.8);
  worldState.config.peaceCryEnabled = true;
  worldState.config.defaultPeaceCryCadenceTicks = 16;
  worldState.config.defaultPeaceCryRadius = 150;
  worldState.config.sightEnabled = true;
  worldState.config.fogDensity = Math.max(worldState.config.fogDensity, 0.012);
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
    const cap = isWoman ? 14 : isIsosceles ? 16 : 13;
    if (movement.type === 'straightDrift') {
      const driftScale = isWoman ? 0.75 : isIsosceles ? 0.65 : 0.8;
      movement.vx *= driftScale;
      movement.vy *= driftScale;
      continue;
    }

    if (movement.type === 'socialNav') {
      movement.maxSpeed = Math.min(movement.maxSpeed, cap);
      movement.maxTurnRate = Math.max(movement.maxTurnRate, isWoman ? 1.4 : 1);
      movement.speed = Math.min(movement.speed, movement.maxSpeed);
      movement.smoothSpeed = Math.min(movement.smoothSpeed, movement.maxSpeed);
      movement.decisionEveryTicks = Math.max(16, movement.decisionEveryTicks);
      movement.intentionMinTicks = Math.max(80, movement.intentionMinTicks);
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
    const cap = isWoman ? 14 : isIsosceles ? 16 : 13;

    const adjustedMovement: SpawnMovementConfig =
      movement.type === 'straightDrift'
        ? {
            ...movement,
            vx: movement.vx * (isWoman ? 0.75 : isIsosceles ? 0.65 : 0.8),
            vy: movement.vy * (isWoman ? 0.75 : isIsosceles ? 0.65 : 0.8),
          }
        : movement.type === 'socialNav'
          ? {
              ...movement,
              maxSpeed: Math.min(movement.maxSpeed, cap),
              maxTurnRate: Math.max(movement.maxTurnRate, isWoman ? 1.4 : 1),
              decisionEveryTicks: Math.max(16, movement.decisionEveryTicks),
              intentionMinTicks: Math.max(80, movement.intentionMinTicks),
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

function applyHarmonicMotionPreset(worldState: typeof world): void {
  for (const [id, movement] of worldState.movements) {
    if (!worldState.entities.has(id)) {
      continue;
    }

    if (movement.type !== 'socialNav') {
      continue;
    }

    movement.maxSpeed = Math.min(Math.max(10, movement.maxSpeed), 15);
    movement.maxTurnRate = Math.min(Math.max(0.8, movement.maxTurnRate), 1.4);
    movement.decisionEveryTicks = Math.max(18, movement.decisionEveryTicks);
    movement.intentionMinTicks = Math.max(88, movement.intentionMinTicks);
    movement.speed = Math.min(movement.speed, movement.maxSpeed);
    movement.smoothSpeed = Math.min(movement.smoothSpeed, movement.maxSpeed);
  }
}

function applyHarmonicMotionPresetToPlan(plan: SpawnRequest[]): SpawnRequest[] {
  return plan.map((request) => {
    if (request.movement.type !== 'socialNav') {
      return request;
    }

    return {
      ...request,
      movement: {
        ...request.movement,
        maxSpeed: Math.min(Math.max(10, request.movement.maxSpeed), 15),
        maxTurnRate: Math.min(Math.max(0.8, request.movement.maxTurnRate), 1.4),
        decisionEveryTicks: Math.max(18, request.movement.decisionEveryTicks),
        intentionMinTicks: Math.max(88, request.movement.intentionMinTicks),
      },
    };
  });
}

function readCheckbox(id: string): boolean {
  const element = document.getElementById(id);
  return element instanceof HTMLInputElement ? element.checked : false;
}

function readSelectedTimelineTypes(): Set<EventType> {
  const selected = new Set<EventType>();
  for (const [eventType, id] of Object.entries(TIMELINE_TYPE_CONTROL_IDS)) {
    if (readCheckbox(id)) {
      selected.add(eventType as EventType);
    }
  }
  return selected;
}

function readSelectedTimelineRankKeys(): Set<string> {
  const container = document.getElementById('timeline-rank-filters');
  if (!(container instanceof HTMLElement)) {
    return new Set<string>();
  }

  const selected = new Set<string>();
  const checkboxes = container.querySelectorAll<HTMLInputElement>('input[data-rank-filter]');
  for (const checkbox of checkboxes) {
    const rankKey = checkbox.dataset.rankFilter;
    if (!rankKey || !checkbox.checked) {
      continue;
    }
    selected.add(rankKey);
  }

  return selected;
}

function wireTimelineControls(): void {
  const typeIds = Object.values(TIMELINE_TYPE_CONTROL_IDS);
  for (const id of typeIds) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLInputElement)) {
      continue;
    }
    element.addEventListener('change', () => {
      const next = readSelectedTimelineTypes();
      selectedTimelineTypes.clear();
      for (const type of next) {
        selectedTimelineTypes.add(type);
      }
    });
  }

  const splitInput = document.getElementById('timeline-split-by-rank');
  if (splitInput instanceof HTMLInputElement) {
    splitInput.addEventListener('change', () => {
      timelineSplitByRank = splitInput.checked;
    });
  }

  const showLegendInput = document.getElementById('timeline-show-legend');
  if (showLegendInput instanceof HTMLInputElement) {
    showLegendInput.addEventListener('change', () => {
      timelineShowLegend = showLegendInput.checked;
    });
  }

  const rankContainer = document.getElementById('timeline-rank-filters');
  if (rankContainer instanceof HTMLElement) {
    rankContainer.addEventListener('change', () => {
      const next = readSelectedTimelineRankKeys();
      selectedTimelineRanks.clear();
      for (const rankKey of next) {
        selectedTimelineRanks.add(rankKey);
      }
    });
  }
}

function syncDynamicRankFilters(): void {
  const container = document.getElementById('timeline-rank-filters');
  if (!(container instanceof HTMLElement)) {
    return;
  }

  const escapeSelectorValue = (value: string): string => {
    const cssEscape = (globalThis as { CSS?: { escape?: (input: string) => string } }).CSS?.escape;
    if (typeof cssEscape === 'function') {
      return cssEscape(value);
    }
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  };

  const observed = eventAnalytics.getObservedRankKeys();
  for (const rankKey of observed) {
    const existing = container.querySelector<HTMLInputElement>(
      `input[data-rank-filter="${escapeSelectorValue(rankKey)}"]`,
    );
    if (existing) {
      continue;
    }

    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = true;
    checkbox.dataset.rankFilter = rankKey;
    label.appendChild(checkbox);
    label.append(` ${rankKey}`);
    container.appendChild(label);
  }
}

function initializeMobileMenu(
  toggleButton: HTMLButtonElement,
  sidebarNode: HTMLElement,
  backdrop: HTMLElement,
): void {
  const menu = new MobileMenuState(toggleButton, sidebarNode, backdrop);
  menu.bind();
}

function syncQuickRunButton(quickButton: HTMLButtonElement, primaryButton: HTMLButtonElement): void {
  quickButton.textContent = primaryButton.textContent || 'Start';
  quickButton.setAttribute(
    'aria-label',
    `Quick ${quickButton.textContent?.toLowerCase() === 'pause' ? 'pause' : 'start'} simulation`,
  );
}

function initializePanelCollapsers(): void {
  const panels = document.querySelectorAll<HTMLElement>('.sidebar .panel');
  panels.forEach((panel, index) => {
    const header = panel.querySelector('h2');
    if (!(header instanceof HTMLHeadingElement)) {
      return;
    }

    const collapseButton = document.createElement('button');
    collapseButton.type = 'button';
    collapseButton.className = 'panel-collapse-btn';
    collapseButton.textContent = '▾';
    collapseButton.setAttribute('aria-label', 'Collapse panel');
    header.appendChild(collapseButton);

    const collapsed = index > 0;
    if (collapsed) {
      panel.classList.add('collapsed');
      collapseButton.textContent = '▸';
    }

    collapseButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isCollapsed = panel.classList.toggle('collapsed');
      collapseButton.textContent = isCollapsed ? '▸' : '▾';
    });
  });
}
