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
import { createWorld } from './core/world';
import { spawnHouses } from './core/worldgen/houses';
import { applySpawnPlan as applyScenarioSpawnPlan, defaultSpawnPlan } from './presets/defaultScenario';
import { createDefaultSystems } from './presets/defaultSimulation';
import {
  createReleaseUiDefaults,
  createReleaseWorldConfigFromUiSettings,
} from './presets/releasePreset';
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
import type { SightVisibilityContext } from './core/perception/sightVisibility';
import {
  requestIntroductionWithNearestUnknown,
} from './systems/introductionIntentSystem';
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
import { buildEntityHoverNarrative } from './ui/entityHoverNarrative';
import { buildNarrativeOverview } from './ui/narrativeOverview';
import { RecentEventNarrativeStore } from './ui/recentEventNarrativeStore';
import { EventDrainPipeline } from './ui/eventDrainPipeline';
import { captureFrameSnapshot, type FrameSnapshot } from './ui/frameSnapshot';
import { RainTimelineStore } from './ui/rainTimelineStore';
import { PolicyTimelineStore } from './ui/policyTimelineStore';
import { installParameterHelp } from './ui/parameterHelp';
import { APP_VERSION } from './version';

const TIMELINE_TYPE_CONTROL_IDS: Partial<Record<EventType, string>> = {
  peaceCryComplianceHalt: 'timeline-type-cry-halt',
  yieldToLady: 'timeline-type-yield-to-lady',
  handshakeAttemptFailed: 'timeline-type-handshake-failed',
  handshake: 'timeline-type-handshake',
  houseEnter: 'timeline-type-house-enter',
  houseExit: 'timeline-type-house-exit',
  inspectionHospitalized: 'timeline-type-inspection-hospitalized',
  inspectionExecuted: 'timeline-type-inspection-executed',
  policyShift: 'timeline-type-policy-shift',
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
const narrativeBulletin = document.getElementById('narrative-overview-bulletin');
const narrativeHeadline = document.getElementById('narrative-overview-headline');
const narrativeReasons = document.getElementById('narrative-overview-reasons');

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

installParameterHelp(document);

const systems = createDefaultSystems();
const releaseUiDefaults = createReleaseUiDefaults();

let worldTopology: WorldTopology = topologyInput.value === 'bounded' ? 'bounded' : 'torus';
const initialBoundary = boundaryFromTopology(worldTopology);
let spawnPlan: SpawnRequest[] = defaultSpawnPlan(initialBoundary);
let environmentSettings: EnvironmentSettings = { ...releaseUiDefaults.environment };
let peaceCrySettings: PeaceCrySettings = { ...releaseUiDefaults.peaceCry };
let reproductionSettings: ReproductionSettings = { ...releaseUiDefaults.reproduction };
let eventHighlightsSettings: EventHighlightsSettings = { ...releaseUiDefaults.eventHighlights };
let flatlanderViewSettings: FlatlanderViewSettings = { ...releaseUiDefaults.flatlanderView };
let fogSightSettings: FogSightSettings = { ...releaseUiDefaults.fogSight };
let southAttractionSettings: SouthAttractionSettings = { ...releaseUiDefaults.southAttraction };
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
const recentEventNarrative = new RecentEventNarrativeStore();
const eventTimelineRenderer = hasEventTimelineUi
  ? new EventTimelineRenderer(eventTimelineCanvas, eventTimelineTooltip)
  : null;
populationHistogram.reset(world);
const camera = new Camera(world.config.width, world.config.height);
const selectionState = new SelectionState();
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
let hoveredWorldClientPoint: Vec2 | null = null;
let lastNarrativeTick = -1;
const NARRATIVE_UPDATE_INTERVAL_TICKS = 45;
let lastBulletinTick = -1;
let lastBulletinText = 'Gazette: waiting for the first notable civic development.';
const narrativeLabelCache = new Map<number, string>();
const eventDrainPipeline = new EventDrainPipeline(
  world.tick,
  () => world.events.drain(),
  [
    (events) => effectsManager.ingest(events),
    (events) => eventAnalytics.ingest(events),
    (events) => recentEventNarrative.ingest(events),
    (events) => recordLegendEvents(events),
  ],
);
const rainTimeline = new RainTimelineStore();
const policyTimeline = new PolicyTimelineStore();

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
    policyTimeline.reset();
    recentEventNarrative.clear();
    lastNarrativeTick = -1;
    lastBulletinTick = -1;
    lastBulletinText = 'Gazette: waiting for the first notable civic development.';
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
    hoveredWorldClientPoint = null;
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
  hoveredWorldClientPoint = null;
  renderSelection();
});

const pickingController = new PickingController({
  canvas,
  camera,
  selectionState,
  getWorld: () => world,
  onSelectionApplied: () => {
    renderSelection();
  },
  onHoverApplied: (hoveredId, _pointWorld, clientPoint) => {
    hoveredWorldEntityId = hoveredId;
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

  refreshNarrativeLabelCache();
  simulation.frame(now);
  refreshNarrativeLabelCache();
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
  policyTimeline.record(world.tick, world.policy.phase);

  renderFlatlanderView(frameSnapshot);
  renderer.render(world, camera, selectionState.selectedId, frameSnapshot, {
    showSouthZoneOverlay: southAttractionSettings.showSouthZoneOverlay,
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
  });
  populationHistogram.render();
  renderEventTimeline();
  renderNarrativeOverview();
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
  const brainAngleDeg = world.brainAngles.get(selectedId)?.brainAngleDeg ?? null;
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
    brainAngleDeg,
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
    null,
    'N/A',
  );
  ui.renderDwellingState(null);
}

function narrativeEntityLabel(entityId: number): string | null {
  const cached = narrativeLabelCache.get(entityId);
  if (cached && cached.trim().length > 0) {
    return cached;
  }
  if (world.houses.has(entityId)) {
    return `House #${entityId}`;
  }
  const name = world.names.get(entityId)?.displayName;
  if (name && name.trim().length > 0) {
    return name;
  }
  const rank = world.ranks.get(entityId)?.rank;
  if (rank) {
    return rank;
  }
  return 'an unnamed inhabitant';
}

function refreshNarrativeLabelCache(): void {
  const ids = [...world.entities].sort((a, b) => a - b);
  for (const id of ids) {
    if (world.houses.has(id)) {
      narrativeLabelCache.set(id, `House #${id}`);
      continue;
    }
    const name = world.names.get(id)?.displayName;
    if (name && name.trim().length > 0) {
      narrativeLabelCache.set(id, name.trim());
      continue;
    }
    const rank = world.ranks.get(id)?.rank;
    if (rank) {
      narrativeLabelCache.set(id, rank);
    }
  }
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

  const history = recentEventNarrative.getEntityHighlights(
    entityId,
    world.tick,
    2,
    3200,
    narrativeEntityLabel,
  );
  const narrative = buildEntityHoverNarrative(
    world,
    entityId,
    rankLabel,
    shapeLabel,
    displayName ?? null,
    history,
    narrativeEntityLabel,
  );
  const hpBarMarkup = narrative.hpBar
    ? [
        `<div class="world-hover-hp">`,
        `<div class="world-hover-hp-label">${escapeHtml(narrative.hpBar.label)}</div>`,
        `<div class="world-hover-hp-track"><div class="world-hover-hp-fill" style="width:${(
          narrative.hpBar.ratio * 100
        ).toFixed(1)}%"></div></div>`,
        `</div>`,
      ].join('')
    : '';

  worldHoverInfo.innerHTML = [
    `<div class="world-hover-title">${escapeHtml(narrative.title)}</div>`,
    hpBarMarkup,
    ...narrative.lines
      .filter((line) => line.length > 0)
      .map((line) => `<div>${escapeHtml(line)}</div>`),
  ].join('');

  const offset = 14;
  worldHoverInfo.style.left = `${hoveredWorldClientPoint.x + offset}px`;
  worldHoverInfo.style.top = `${hoveredWorldClientPoint.y + offset}px`;
  worldHoverInfo.hidden = false;
}

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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
  const selectedVision = world.vision.get(selectedId);
  const selectedPerception = world.perceptions.get(selectedId);
  if (!selectedVision || !selectedPerception || !selectedVision.enabled || selectedPerception.sightSkill <= 0) {
    clearFlatlanderHover();
    flatlanderViewRenderer.clearWithMessage('Selected entity has no active sight');
    return;
  }

  const hasDimnessCue = world.config.fogDensity > 0;
  const localFog = fogDensityAt(frameSnapshot.fogField, selectedEyePose.eyeWorld);
  const perceptionDistanceCap = Math.min(Math.max(1, selectedVision.range), world.config.fogMaxDistance);
  const configKey = [
    flatlanderConfigKey(flatlanderViewSettings),
    selectedEyePose.fovRad.toFixed(6),
    selectedVision.range.toFixed(3),
    selectedPerception.sightSkill.toFixed(3),
    hasDimnessCue ? localFog.toFixed(6) : '0',
    world.config.fogMinIntensity.toFixed(6),
  ].join('|');
  const effectiveFlatlanderSettings: FlatlanderViewSettings = {
    ...flatlanderViewSettings,
    // Keep 1D panel aligned with the same eye/FOV/fog semantics driving behavior.
    fovRad: selectedEyePose.fovRad,
    lookOffsetRad: 0,
    maxDistance: perceptionDistanceCap,
    fogDensity: hasDimnessCue ? localFog : 0,
    minVisibleIntensity: 0,
    includeObstacles: true,
    includeBoundaries: true,
    inanimateDimMultiplier: 1,
  };
  const sightContext: SightVisibilityContext = {
    hasDimnessCue,
    sightSkill: selectedPerception.sightSkill,
    fogMinIntensity: world.config.fogMinIntensity,
  };
  if (
    flatlanderScanDirty ||
    world.tick !== lastFlatlanderScanTick ||
    selectedId !== lastFlatlanderScanViewerId ||
    configKey !== lastFlatlanderScanConfigKey
  ) {
    cachedFlatlanderScan = computeFlatlanderScan(world, selectedId, effectiveFlatlanderSettings, sightContext);
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
      colorEnabled: frameSnapshot.colorEnabled,
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
    showPolicyTrack: selectedTypes.has('policyShift'),
    policyIntervals: policyTimeline.getIntervals(world.tick),
  });
  eventTimelineLegend.hidden = !timelineShowLegend;
}

function renderNarrativeOverview(): void {
  if (!(narrativeHeadline instanceof HTMLElement) || !(narrativeReasons instanceof HTMLElement)) {
    return;
  }
  if (lastNarrativeTick === world.tick) {
    return;
  }
  if (lastNarrativeTick >= 0 && world.tick - lastNarrativeTick < NARRATIVE_UPDATE_INTERVAL_TICKS) {
    return;
  }
  lastNarrativeTick = world.tick;

  const allTypes = new Set<EventType>([
    'peaceCryComplianceHalt',
    'yieldToLady',
    'handshakeAttemptFailed',
    'handshake',
    'houseEnter',
    'houseExit',
    'inspectionHospitalized',
    'inspectionExecuted',
    'policyShift',
    'death',
    'birth',
    'regularized',
  ]);
  const summaries = eventAnalytics.getFilteredSummaries({
    selectedTypes: allTypes,
    selectedRankKeys: new Set<string>(),
    splitByRank: false,
    focusEntityId: null,
  });

  let totalPeople = 0;
  let insidePeople = 0;
  let outsidePeople = 0;
  for (const id of world.entities) {
    if (world.staticObstacles.has(id)) {
      continue;
    }
    totalPeople += 1;
    const dwelling = world.dwellings.get(id);
    if (dwelling?.state === 'inside') {
      insidePeople += 1;
    } else {
      outsidePeople += 1;
    }
  }

  const narrativeTypeCounts = recentEventNarrative.countByType(world.tick, 1800, ['stab', 'peaceCry']);

  const overview = buildNarrativeOverview(
    {
      tick: world.tick,
      isRaining: world.weather.isRaining,
      totalPeople,
      outsidePeople,
      insidePeople,
      seekingShelter: world.seekShelterIntentCount,
      seekingHome: world.seekHomeIntentCount,
      stuckNearHouse: world.stuckNearHouseCount,
      recentStabs: narrativeTypeCounts.stab ?? 0,
      recentPeaceCries: narrativeTypeCounts.peaceCry ?? 0,
      policyPhase: world.policy.phase,
      policyTicksRemaining: world.policy.ticksRemaining,
      policyDriver: world.policy.reason,
      notableEvents: recentEventNarrative
        .getGlobalHighlights(world.tick, 3, 1800, narrativeEntityLabel)
        .map((event) => `At tick ${event.tick}, ${event.text}`),
    },
    summaries,
  );

  narrativeHeadline.textContent = overview.headline;
  if (narrativeBulletin instanceof HTMLElement) {
    const shouldRotateBulletin =
      lastBulletinTick < 0 || world.tick - lastBulletinTick >= 180 || overview.bulletinLine !== lastBulletinText;
    if (shouldRotateBulletin) {
      lastBulletinTick = world.tick;
      lastBulletinText = overview.bulletinLine;
    }
    narrativeBulletin.textContent = lastBulletinText;
  }
  narrativeReasons.innerHTML = '';
  for (const reason of overview.reasons) {
    const item = document.createElement('li');
    item.textContent = reason;
    narrativeReasons.appendChild(item);
  }
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
) {
  return createReleaseWorldConfigFromUiSettings(
    topology,
    settings,
    environment,
    peaceCry,
    reproduction,
    fogSight,
  );
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
  worldState.config.colorEnabled = environment.colorEnabled;
  if (!worldState.config.rainEnabled) {
    worldState.weather.isRaining = false;
    worldState.weather.ticksUntilRain = Math.max(1, Math.round(worldState.config.rainBasePeriodTicks));
    worldState.weather.ticksRemainingRain = Math.max(1, Math.round(worldState.config.rainBaseDurationTicks));
  }
}

function applyPeaceCrySettingsToWorld(worldState: typeof world, settings: PeaceCrySettings): void {
  worldState.config.peaceCryEnabled = settings.enabled;
  worldState.config.strictPeaceCryComplianceEnabled = settings.strictComplianceEnabled;
  worldState.config.peaceCryComplianceStillnessTicks = Math.max(
    1,
    Math.round(settings.complianceStillnessTicks),
  );
  worldState.config.northYieldEtiquetteEnabled = settings.northYieldEnabled;
  worldState.config.northYieldRadius = Math.max(1, settings.northYieldRadius);
  worldState.config.rainCurfewEnabled = settings.rainCurfewEnabled;
  worldState.config.rainCurfewOutsideGraceTicks = Math.max(
    1,
    Math.round(settings.rainCurfewOutsideGraceTicks),
  );
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
  worldState.config.priestMediationEnabled = settings.priestMediationEnabled;
  worldState.config.priestMediationRadius = Math.max(0, settings.priestMediationRadius);
  worldState.config.priestMediationBias = Math.max(0, settings.priestMediationBias);
}

function applyPeaceCryDefaultsToWomen(worldState: typeof world): void {
  const cadenceTicks = Math.max(1, Math.round(worldState.config.defaultPeaceCryCadenceTicks));
  const radius = Math.max(0, worldState.config.defaultPeaceCryRadius);

  for (const [entityId, peaceCry] of worldState.peaceCry) {
    if (!worldState.entities.has(entityId)) {
      continue;
    }
    const shape = worldState.shapes.get(entityId);
    if (!shape || shape.kind !== 'segment') {
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
