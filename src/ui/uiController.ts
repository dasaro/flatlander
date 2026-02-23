import type {
  AgeComponent,
  DurabilityComponent,
  FemaleStatusComponent,
  FeelingComponent,
  FertilityComponent,
  HearingHitComponent,
  IrregularityComponent,
  KnowledgeComponent,
  LegacyComponent,
  LineageComponent,
  MovementComponent,
  PerceptionComponent,
  PeaceCryComponent,
  PregnancyComponent,
  SwayComponent,
  VoiceComponent,
  VoiceSignature,
  VisionComponent,
} from '../core/components';
import {
  DEFAULT_ISOSCELES_BASE_RATIO,
  MAX_ISOSCELES_BASE_RATIO,
  MIN_ISOSCELES_BASE_RATIO,
  type SpawnFemaleStatusConfig,
  type SpawnMovementConfig,
  type SpawnPerceptionConfig,
  type SpawnRequest,
  type SpawnVoiceConfig,
} from '../core/factory';
import { clampFemaleRank } from '../core/femaleStatus';
import { Rank } from '../core/rank';
import type { RankComponent } from '../core/rank';
import type { ShapeComponent, TriangleKind } from '../core/shapes';
import { boundaryFromTopology, type WorldTopology } from '../core/topology';
import type { World } from '../core/world';
import type { Vec2 } from '../geometry/vector';
import type { FlatlanderViewConfig } from '../render/flatlanderScan';

export interface SouthAttractionSettings {
  enabled: boolean;
  strength: number;
  womenMultiplier: number;
  zoneStartFrac: number;
  zoneEndFrac: number;
  drag: number;
  maxTerminal: number;
  escapeFraction: number;
  showSouthZoneOverlay: boolean;
  showClickDebug: boolean;
}

export interface EnvironmentSettings {
  housesEnabled: boolean;
  houseCount: number;
  townPopulation: number;
  allowTriangularForts: boolean;
  allowSquareHouses: boolean;
  houseSize: number;
}

export interface PeaceCrySettings {
  enabled: boolean;
  cadenceTicks: number;
  radius: number;
}

export interface ReproductionSettings {
  enabled: boolean;
  gestationTicks: number;
  matingRadius: number;
  conceptionChancePerTick: number;
  femaleBirthProbability: number;
  maxPopulation: number;
  irregularBirthsEnabled: boolean;
  irregularBirthBaseChance: number;
}

export interface EventHighlightsSettings {
  enabled: boolean;
  intensity: number;
  capPerTick: number;
  showFeeling: boolean;
  focusOnSelected: boolean;
  showHearingOverlay: boolean;
  showTalkingOverlay: boolean;
  strokeByKills: boolean;
  showContactNetwork: boolean;
  networkShowParents: boolean;
  networkShowKnown: boolean;
  networkMaxKnownEdges: number;
  networkShowOnlyOnScreen: boolean;
  networkFocusRadius: number;
  dimByAge: boolean;
  dimByDeterioration: boolean;
  dimStrength: number;
  fogPreviewEnabled: boolean;
  fogPreviewStrength: number;
  fogPreviewHideBelowMin: boolean;
  fogPreviewRings: boolean;
}

export type FlatlanderViewSettings = FlatlanderViewConfig;

export interface FogSightSettings {
  sightEnabled: boolean;
  fogDensity: number;
}

interface UiCallbacks {
  onToggleRun: () => boolean;
  onStep: () => void;
  onReset: (seed: number) => void;
  onSpawn: (request: SpawnRequest) => void;
  onTopologyUpdate: (topology: WorldTopology) => void;
  onEnvironmentUpdate: (settings: EnvironmentSettings) => void;
  onPeaceCryDefaultsUpdate: (settings: PeaceCrySettings) => void;
  onApplyPeaceCryDefaultsToWomen: () => void;
  onReproductionUpdate: (settings: ReproductionSettings) => void;
  onEventHighlightsUpdate: (settings: EventHighlightsSettings) => void;
  onClearEventHighlights: () => void;
  onFlatlanderViewUpdate: (settings: FlatlanderViewSettings) => void;
  onFogSightUpdate: (settings: FogSightSettings) => void;
  onApplyNovelSafetyPreset: () => void;
  onApplyHarmonicMotionPreset: () => void;
  onSouthAttractionUpdate: (settings: SouthAttractionSettings) => void;
  onInspectorUpdate: (movement: SpawnMovementConfig) => void;
  onInspectorVisionUpdate: (vision: Partial<VisionComponent>) => void;
  onInspectorPerceptionUpdate: (perception: Partial<SpawnPerceptionConfig>) => void;
  onInspectorVoiceUpdate: (voice: Partial<SpawnVoiceConfig>) => void;
  onInspectorPeaceCryUpdate: (peaceCry: Partial<PeaceCryComponent>) => void;
  onInspectorFeelingUpdate: (feeling: Partial<FeelingComponent>) => void;
}

interface InputRefs {
  runButton: HTMLButtonElement;
  stepButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  novelSafetyPresetButton: HTMLButtonElement;
  harmonicMotionPresetButton: HTMLButtonElement;
  seedInput: HTMLInputElement;
  worldTopology: HTMLSelectElement;
  envHousesEnabled: HTMLInputElement;
  envHouseCount: HTMLInputElement;
  envTownPopulation: HTMLInputElement;
  envAllowTriangularForts: HTMLInputElement;
  envAllowSquareHouses: HTMLInputElement;
  envHouseSize: HTMLInputElement;
  peaceCryEnabledGlobal: HTMLInputElement;
  peaceCryCadenceGlobal: HTMLInputElement;
  peaceCryRadiusGlobal: HTMLInputElement;
  peaceCryApplyAllButton: HTMLButtonElement;
  reproductionEnabled: HTMLInputElement;
  reproductionGestationTicks: HTMLInputElement;
  reproductionMatingRadius: HTMLInputElement;
  reproductionConceptionChance: HTMLInputElement;
  reproductionFemaleBirthProbability: HTMLInputElement;
  reproductionMaxPopulation: HTMLInputElement;
  reproductionIrregularEnabled: HTMLInputElement;
  reproductionIrregularBaseChance: HTMLInputElement;
  eventHighlightsEnabled: HTMLInputElement;
  eventHighlightsShowLegend: HTMLInputElement;
  eventHighlightsIntensity: HTMLInputElement;
  eventHighlightsCap: HTMLInputElement;
  eventShowFeeling: HTMLInputElement;
  eventFocusSelected: HTMLInputElement;
  eventShowHearing: HTMLInputElement;
  eventShowTalking: HTMLInputElement;
  eventStrokeKills: HTMLInputElement;
  overlayContactNetwork: HTMLInputElement;
  overlayNetworkParents: HTMLInputElement;
  overlayNetworkKnown: HTMLInputElement;
  overlayNetworkMaxKnown: HTMLInputElement;
  overlayNetworkOnScreen: HTMLInputElement;
  overlayNetworkFocusRadius: HTMLInputElement;
  overlayDimAge: HTMLInputElement;
  overlayDimDeterioration: HTMLInputElement;
  overlayDimStrength: HTMLInputElement;
  overlayFogPreview: HTMLInputElement;
  overlayFogPreviewStrength: HTMLInputElement;
  overlayFogPreviewHideMin: HTMLInputElement;
  overlayFogRings: HTMLInputElement;
  eventHighlightsClearButton: HTMLButtonElement;
  flatlanderEnabled: HTMLInputElement;
  flatlanderRays: HTMLSelectElement;
  flatlanderFov: HTMLSelectElement;
  flatlanderLookOffset: HTMLInputElement;
  flatlanderMaxDistance: HTMLInputElement;
  flatlanderFogDensity: HTMLInputElement;
  flatlanderGrayscale: HTMLInputElement;
  flatlanderIncludeObstacles: HTMLInputElement;
  fogSightEnabled: HTMLInputElement;
  fogSightDensity: HTMLInputElement;
  legendPanel: HTMLElement;
  southEnabled: HTMLInputElement;
  southStrength: HTMLInputElement;
  southWomenMultiplier: HTMLInputElement;
  southZoneStart: HTMLInputElement;
  southZoneEnd: HTMLInputElement;
  southDrag: HTMLInputElement;
  southMaxTerminal: HTMLInputElement;
  southEscapeFraction: HTMLInputElement;
  southShowZone: HTMLInputElement;
  southShowClickDebug: HTMLInputElement;
  spawnButton: HTMLButtonElement;
  spawnShape: HTMLSelectElement;
  spawnSides: HTMLInputElement;
  spawnIrregular: HTMLInputElement;
  spawnTriangleKind: HTMLSelectElement;
  spawnBaseRatio: HTMLInputElement;
  spawnSize: HTMLInputElement;
  spawnCount: HTMLInputElement;
  spawnMovementType: HTMLSelectElement;
  spawnBoundary: HTMLSelectElement;
  spawnSpeed: HTMLInputElement;
  spawnTurnRate: HTMLInputElement;
  spawnDecisionTicks: HTMLInputElement;
  spawnIntentionMinTicks: HTMLInputElement;
  spawnVx: HTMLInputElement;
  spawnVy: HTMLInputElement;
  spawnTargetX: HTMLInputElement;
  spawnTargetY: HTMLInputElement;
  spawnFeelingEnabled: HTMLInputElement;
  spawnFeelCooldown: HTMLInputElement;
  spawnApproachSpeed: HTMLInputElement;
  spawnFemaleRank: HTMLSelectElement;
  spawnMimicryEnabled: HTMLInputElement;
  spawnMimicrySignature: HTMLSelectElement;
  spawnFemaleRankRow: HTMLElement;
  spawnMimicryRow: HTMLElement;
  spawnMimicrySignatureRow: HTMLElement;
  spawnSidesRow: HTMLElement;
  spawnIrregularRow: HTMLElement;
  spawnTriangleKindRow: HTMLElement;
  spawnBaseRatioRow: HTMLElement;
  spawnSpeedRow: HTMLElement;
  spawnTurnRateRow: HTMLElement;
  spawnSocialDecisionRow: HTMLElement;
  spawnSocialIntentionRow: HTMLElement;
  spawnDriftRow: HTMLElement;
  spawnTargetRow: HTMLElement;
  selectedId: HTMLElement;
  inspectorNone: HTMLElement;
  inspectorFields: HTMLElement;
  inspectorRank: HTMLElement;
  inspectorShape: HTMLElement;
  inspectorKills: HTMLElement;
  inspectorMovementType: HTMLSelectElement;
  inspectorBoundary: HTMLSelectElement;
  inspectorVisionEnabled: HTMLInputElement;
  inspectorVisionRange: HTMLInputElement;
  inspectorAvoidDistance: HTMLInputElement;
  inspectorHearingSkill: HTMLInputElement;
  inspectorHearingRadius: HTMLInputElement;
  inspectorHeardSignature: HTMLElement;
  inspectorPeaceCryRow: HTMLElement;
  inspectorPeaceCryEnabled: HTMLInputElement;
  inspectorPeaceCryCadence: HTMLInputElement;
  inspectorPeaceCryRadius: HTMLInputElement;
  inspectorFeelingEnabled: HTMLInputElement;
  inspectorFeelCooldown: HTMLInputElement;
  inspectorApproachSpeed: HTMLInputElement;
  inspectorKnownCount: HTMLElement;
  inspectorLastFeltTick: HTMLElement;
  inspectorKnownList: HTMLElement;
  inspectorReproductionRow: HTMLElement;
  inspectorFertilityEnabled: HTMLElement;
  inspectorFertilityMature: HTMLElement;
  inspectorPregnant: HTMLElement;
  inspectorPregnancyFather: HTMLElement;
  inspectorPregnancyTicks: HTMLElement;
  inspectorSpeed: HTMLInputElement;
  inspectorTurnRate: HTMLInputElement;
  inspectorDecisionTicks: HTMLInputElement;
  inspectorIntentionMinTicks: HTMLInputElement;
  inspectorVx: HTMLInputElement;
  inspectorVy: HTMLInputElement;
  inspectorTargetX: HTMLInputElement;
  inspectorTargetY: HTMLInputElement;
  inspectorCurrentIntention: HTMLElement;
  inspectorIntentionLeft: HTMLElement;
  inspectorGeneration: HTMLElement;
  inspectorDynastyId: HTMLElement;
  inspectorMotherId: HTMLElement;
  inspectorFatherId: HTMLElement;
  inspectorAncestors: HTMLElement;
  inspectorLegacyBirths: HTMLElement;
  inspectorLegacyKills: HTMLElement;
  inspectorLegacyHandshakes: HTMLElement;
  inspectorLegacyRegularizations: HTMLElement;
  inspectorLegacyDescendants: HTMLElement;
  inspectorAge: HTMLElement;
  inspectorDurability: HTMLElement;
  inspectorTriangleInfoRow: HTMLElement;
  inspectorTriangleKind: HTMLElement;
  inspectorBaseRatio: HTMLElement;
  inspectorIrregularRow: HTMLElement;
  inspectorIrregularState: HTMLElement;
  inspectorIrregularDeviation: HTMLElement;
  inspectorVoiceRow: HTMLElement;
  inspectorVoiceEnabled: HTMLInputElement;
  inspectorVoiceSignature: HTMLSelectElement;
  inspectorFemaleRankRow: HTMLElement;
  inspectorFemaleRank: HTMLElement;
  inspectorSwayRow: HTMLElement;
  inspectorSwayAmplitude: HTMLElement;
  inspectorSwayFrequency: HTMLElement;
  inspectorSpeedRow: HTMLElement;
  inspectorTurnRateRow: HTMLElement;
  inspectorSocialRow: HTMLElement;
  inspectorLineageRow: HTMLElement;
  inspectorDriftRow: HTMLElement;
  inspectorTargetRow: HTMLElement;
  tickValue: HTMLElement;
  seedValue: HTMLElement;
  deathsValue: HTMLElement;
  regularizedValue: HTMLElement;
  totalAliveValue: HTMLElement;
  rankList: HTMLElement;
}

export class UIController {
  private readonly refs: InputRefs;
  private selectedEntityId: number | null = null;

  constructor(private readonly callbacks: UiCallbacks) {
    this.refs = collectRefs();
    this.syncLegendVisibility();
    this.syncBoundaryControlsToTopology(this.readTopology());
    const environment = this.readEnvironmentSettings();
    this.syncEnvironmentFieldState(environment);
    const peaceCry = this.readPeaceCrySettings();
    const reproduction = this.readReproductionSettings();
    this.wireControls();
    this.updateSpawnFieldVisibility();
    this.updateInspectorFieldVisibility();
    this.callbacks.onEnvironmentUpdate(environment);
    this.callbacks.onPeaceCryDefaultsUpdate(peaceCry);
    this.callbacks.onReproductionUpdate(reproduction);
    this.callbacks.onEventHighlightsUpdate(this.readEventHighlightsSettings());
    this.callbacks.onFlatlanderViewUpdate(this.readFlatlanderViewSettings());
    this.callbacks.onFogSightUpdate(this.readFogSightSettings());
    this.callbacks.onSouthAttractionUpdate(this.readSouthAttractionSettings());
    this.renderSelected(
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
  }

  renderStats(world: World): void {
    this.refs.tickValue.textContent = String(world.tick);
    this.refs.seedValue.textContent = String(world.seed);
    this.refs.deathsValue.textContent = String(world.deathsThisTick);
    this.refs.regularizedValue.textContent = String(world.regularizedThisTick);
    this.refs.totalAliveValue.textContent = String(world.entities.size);

    const counts = new Map<string, number>();
    for (const id of world.entities) {
      const rank = world.ranks.get(id);
      const shape = world.shapes.get(id);
      if (!rank || !shape) {
        continue;
      }

      const key = rankLabel(rank, shape);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    this.refs.rankList.innerHTML = '';
    const preferredOrder = [
      Rank.Woman,
      Rank.Priest,
      'Triangle (Equilateral)',
      'Triangle (Isosceles)',
      Rank.Gentleman,
      Rank.Noble,
      Rank.NearCircle,
      Rank.Irregular,
    ];

    const seen = new Set<string>();
    for (const label of preferredOrder) {
      const value = counts.get(label) ?? 0;
      const item = document.createElement('li');
      item.textContent = `${label}: ${value}`;
      this.refs.rankList.appendChild(item);
      seen.add(label);
    }

    for (const [label, value] of [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (seen.has(label)) {
        continue;
      }
      const item = document.createElement('li');
      item.textContent = `${label}: ${value}`;
      this.refs.rankList.appendChild(item);
    }
  }

  renderSelected(
    entityId: number | null,
    movement: MovementComponent | null,
    shape: ShapeComponent | null,
    rank: RankComponent | null,
    vision: VisionComponent | null,
    perception: PerceptionComponent | null,
    voice: VoiceComponent | null,
    hearingHit: HearingHitComponent | null,
    peaceCry: PeaceCryComponent | null,
    feeling: FeelingComponent | null,
    knowledge: KnowledgeComponent | null,
    fertility: FertilityComponent | null,
    pregnancy: PregnancyComponent | null,
    age: AgeComponent | null,
    irregularity: IrregularityComponent | null,
    femaleStatus: FemaleStatusComponent | null,
    sway: SwayComponent | null,
    killCount: number | null,
    lineage: LineageComponent | null,
    legacy: LegacyComponent | null,
    durability: DurabilityComponent | null,
    ancestorsLabel: string,
  ): void {
    this.selectedEntityId = entityId;
    if (
      entityId === null ||
      movement === null ||
      shape === null ||
      rank === null ||
      vision === null ||
      perception === null ||
      voice === null ||
      feeling === null ||
      knowledge === null
    ) {
      this.refs.selectedId.textContent = 'None';
      this.refs.inspectorRank.textContent = 'N/A';
      this.refs.inspectorShape.textContent = 'N/A';
      this.refs.inspectorKills.textContent = '0';
      this.refs.inspectorHearingSkill.value = '0.50';
      this.refs.inspectorHearingRadius.value = '180';
      this.refs.inspectorHeardSignature.textContent = 'None';
      this.refs.inspectorKnownCount.textContent = '0';
      this.refs.inspectorLastFeltTick.textContent = 'Never';
      this.refs.inspectorKnownList.innerHTML = '';
      this.refs.inspectorReproductionRow.hidden = true;
      this.refs.inspectorFertilityEnabled.textContent = 'N/A';
      this.refs.inspectorFertilityMature.textContent = 'N/A';
      this.refs.inspectorPregnant.textContent = 'N/A';
      this.refs.inspectorPregnancyFather.textContent = 'N/A';
      this.refs.inspectorPregnancyTicks.textContent = 'N/A';
      this.refs.inspectorCurrentIntention.textContent = 'N/A';
      this.refs.inspectorIntentionLeft.textContent = 'N/A';
      this.refs.inspectorGeneration.textContent = 'N/A';
      this.refs.inspectorDynastyId.textContent = 'N/A';
      this.refs.inspectorMotherId.textContent = 'N/A';
      this.refs.inspectorFatherId.textContent = 'N/A';
      this.refs.inspectorAncestors.textContent = 'N/A';
      this.refs.inspectorLegacyBirths.textContent = '0';
      this.refs.inspectorLegacyKills.textContent = '0';
      this.refs.inspectorLegacyHandshakes.textContent = '0';
      this.refs.inspectorLegacyRegularizations.textContent = '0';
      this.refs.inspectorLegacyDescendants.textContent = '0';
      this.refs.inspectorAge.textContent = '0';
      this.refs.inspectorDurability.textContent = 'N/A';
      this.refs.inspectorNone.hidden = false;
      this.refs.inspectorFields.hidden = true;
      this.refs.inspectorTriangleInfoRow.hidden = true;
      this.refs.inspectorIrregularRow.hidden = true;
      this.refs.inspectorVoiceRow.hidden = true;
      this.refs.inspectorFemaleRankRow.hidden = true;
      this.refs.inspectorSwayRow.hidden = true;
      this.refs.inspectorPeaceCryRow.hidden = true;
      return;
    }

    this.refs.selectedId.textContent = String(entityId);
    this.refs.inspectorRank.textContent = rankLabel(rank, shape);
    this.refs.inspectorShape.textContent = shapeLabel(shape);
    this.refs.inspectorKills.textContent = String(Math.max(0, Math.round(killCount ?? 0)));
    this.refs.inspectorNone.hidden = true;
    this.refs.inspectorFields.hidden = false;

    this.refs.inspectorMovementType.value = movement.type;
    this.refs.inspectorBoundary.value = movement.boundary;
    this.refs.inspectorVisionEnabled.checked = vision.enabled;
    this.refs.inspectorVisionRange.value = vision.range.toFixed(1);
    this.refs.inspectorAvoidDistance.value = vision.avoidDistance.toFixed(1);
    this.refs.inspectorHearingSkill.value = perception.hearingSkill.toFixed(2);
    this.refs.inspectorHearingRadius.value = perception.hearingRadius.toFixed(1);
    this.refs.inspectorHeardSignature.textContent = hearingHit ? hearingHit.signature : 'None';

    if (peaceCry) {
      this.refs.inspectorPeaceCryRow.hidden = false;
      this.refs.inspectorPeaceCryEnabled.checked = peaceCry.enabled;
      this.refs.inspectorPeaceCryCadence.value = String(Math.max(1, Math.round(peaceCry.cadenceTicks)));
      this.refs.inspectorPeaceCryRadius.value = peaceCry.radius.toFixed(1);
    } else {
      this.refs.inspectorPeaceCryRow.hidden = true;
      this.refs.inspectorPeaceCryEnabled.checked = false;
      this.refs.inspectorPeaceCryCadence.value = '20';
      this.refs.inspectorPeaceCryRadius.value = '120';
    }

    this.refs.inspectorFeelingEnabled.checked = feeling.enabled;
    this.refs.inspectorFeelCooldown.value = String(Math.max(0, Math.round(feeling.feelCooldownTicks)));
    this.refs.inspectorApproachSpeed.value = feeling.approachSpeed.toFixed(1);
    this.refs.inspectorKnownCount.textContent = String(knowledge.known.size);
    this.refs.inspectorLastFeltTick.textContent = Number.isFinite(feeling.lastFeltTick)
      ? String(Math.round(feeling.lastFeltTick))
      : 'Never';
    this.renderKnownList(knowledge);
    this.refs.inspectorGeneration.textContent = lineage ? String(lineage.generation) : '0';
    this.refs.inspectorDynastyId.textContent = lineage ? String(lineage.dynastyId) : 'N/A';
    this.refs.inspectorMotherId.textContent = lineage?.motherId !== null && lineage?.motherId !== undefined
      ? String(lineage.motherId)
      : 'Unknown';
    this.refs.inspectorFatherId.textContent = lineage?.fatherId !== null && lineage?.fatherId !== undefined
      ? String(lineage.fatherId)
      : 'Unknown';
    this.refs.inspectorAncestors.textContent = ancestorsLabel;
    this.refs.inspectorLegacyBirths.textContent = String(legacy?.births ?? 0);
    this.refs.inspectorLegacyKills.textContent = String(legacy?.deathsCaused ?? 0);
    this.refs.inspectorLegacyHandshakes.textContent = String(legacy?.handshakes ?? 0);
    this.refs.inspectorLegacyRegularizations.textContent = String(legacy?.regularizations ?? 0);
    this.refs.inspectorLegacyDescendants.textContent = String(legacy?.descendantsAlive ?? 0);
    this.refs.inspectorAge.textContent = String(Math.max(0, age?.ticksAlive ?? 0));
    this.refs.inspectorDurability.textContent = durability
      ? `${Math.max(0, durability.hp).toFixed(1)} / ${durability.maxHp.toFixed(1)}`
      : 'N/A';

    if (shape.kind === 'segment' && fertility) {
      const mature = (age?.ticksAlive ?? 0) >= fertility.maturityTicks;
      this.refs.inspectorReproductionRow.hidden = false;
      this.refs.inspectorFertilityEnabled.textContent = fertility.enabled ? 'Yes' : 'No';
      this.refs.inspectorFertilityMature.textContent = mature ? 'Yes' : 'No';
      this.refs.inspectorPregnant.textContent = pregnancy ? 'Yes' : 'No';
      this.refs.inspectorPregnancyFather.textContent = pregnancy ? String(pregnancy.fatherId) : 'None';
      this.refs.inspectorPregnancyTicks.textContent = pregnancy
        ? String(Math.max(0, Math.round(pregnancy.ticksRemaining)))
        : '0';
    } else {
      this.refs.inspectorReproductionRow.hidden = true;
      this.refs.inspectorFertilityEnabled.textContent = 'N/A';
      this.refs.inspectorFertilityMature.textContent = 'N/A';
      this.refs.inspectorPregnant.textContent = 'N/A';
      this.refs.inspectorPregnancyFather.textContent = 'N/A';
      this.refs.inspectorPregnancyTicks.textContent = 'N/A';
    }

    if (movement.type === 'straightDrift') {
      this.refs.inspectorVx.value = movement.vx.toFixed(2);
      this.refs.inspectorVy.value = movement.vy.toFixed(2);
      this.refs.inspectorSpeed.value = '30';
      this.refs.inspectorTurnRate.value = '2';
      this.refs.inspectorDecisionTicks.value = '16';
      this.refs.inspectorIntentionMinTicks.value = '80';
      this.refs.inspectorTargetX.value = '500';
      this.refs.inspectorTargetY.value = '350';
      this.refs.inspectorCurrentIntention.textContent = 'N/A';
      this.refs.inspectorIntentionLeft.textContent = 'N/A';
    } else if (movement.type === 'socialNav') {
      this.refs.inspectorSpeed.value = movement.maxSpeed.toFixed(2);
      this.refs.inspectorTurnRate.value = movement.maxTurnRate.toFixed(2);
      this.refs.inspectorDecisionTicks.value = String(Math.max(1, Math.round(movement.decisionEveryTicks)));
      this.refs.inspectorIntentionMinTicks.value = String(Math.max(1, Math.round(movement.intentionMinTicks)));
      this.refs.inspectorVx.value = '0';
      this.refs.inspectorVy.value = '0';
      this.refs.inspectorTargetX.value = movement.goal?.x?.toFixed(2) ?? '500';
      this.refs.inspectorTargetY.value = movement.goal?.y?.toFixed(2) ?? '350';
      this.refs.inspectorCurrentIntention.textContent = movement.intention;
      this.refs.inspectorIntentionLeft.textContent = String(Math.max(0, movement.intentionTicksLeft));
    } else if (movement.type === 'randomWalk') {
      this.refs.inspectorSpeed.value = movement.speed.toFixed(2);
      this.refs.inspectorTurnRate.value = movement.turnRate.toFixed(2);
      this.refs.inspectorDecisionTicks.value = '16';
      this.refs.inspectorIntentionMinTicks.value = '80';
      this.refs.inspectorVx.value = '0';
      this.refs.inspectorVy.value = '0';
      this.refs.inspectorTargetX.value = '500';
      this.refs.inspectorTargetY.value = '350';
      this.refs.inspectorCurrentIntention.textContent = 'N/A';
      this.refs.inspectorIntentionLeft.textContent = 'N/A';
    } else {
      this.refs.inspectorSpeed.value = movement.speed.toFixed(2);
      this.refs.inspectorTurnRate.value = movement.turnRate.toFixed(2);
      this.refs.inspectorDecisionTicks.value = '16';
      this.refs.inspectorIntentionMinTicks.value = '80';
      this.refs.inspectorVx.value = '0';
      this.refs.inspectorVy.value = '0';
      this.refs.inspectorTargetX.value = movement.target.x.toFixed(2);
      this.refs.inspectorTargetY.value = movement.target.y.toFixed(2);
      this.refs.inspectorCurrentIntention.textContent = 'N/A';
      this.refs.inspectorIntentionLeft.textContent = 'N/A';
    }

    if (shape.kind === 'polygon' && shape.sides === 3) {
      this.refs.inspectorTriangleInfoRow.hidden = false;
      const baseRatio = shape.isoscelesBaseRatio;
      const hasBaseRatio = typeof baseRatio === 'number' && Number.isFinite(baseRatio);
      const ratioText = hasBaseRatio ? baseRatio.toFixed(3) : 'N/A';
      const triangleKindLabel =
        shape.triangleKind ?? (hasBaseRatio ? 'Isosceles' : 'Equilateral');

      this.refs.inspectorTriangleKind.textContent = triangleKindLabel;
      this.refs.inspectorBaseRatio.textContent = ratioText;
    } else {
      this.refs.inspectorTriangleInfoRow.hidden = true;
      this.refs.inspectorTriangleKind.textContent = 'N/A';
      this.refs.inspectorBaseRatio.textContent = 'N/A';
    }

    const isIsoscelesTriangle =
      shape.kind === 'polygon' && shape.sides === 3 && shape.triangleKind === 'Isosceles';
    if (isIsoscelesTriangle) {
      this.refs.inspectorVoiceRow.hidden = false;
      this.refs.inspectorVoiceEnabled.checked = voice.mimicryEnabled;
      this.refs.inspectorVoiceSignature.value = voice.mimicrySignature ?? 'Square';
    } else {
      this.refs.inspectorVoiceRow.hidden = true;
      this.refs.inspectorVoiceEnabled.checked = false;
      this.refs.inspectorVoiceSignature.value = 'Square';
    }

    if (shape.kind === 'segment' && femaleStatus) {
      this.refs.inspectorFemaleRankRow.hidden = false;
      this.refs.inspectorFemaleRank.textContent = femaleStatus.femaleRank;
      this.refs.inspectorSwayRow.hidden = false;
      this.refs.inspectorSwayAmplitude.textContent = sway
        ? sway.baseAmplitudeRad.toFixed(3)
        : 'N/A';
      this.refs.inspectorSwayFrequency.textContent = sway
        ? sway.baseFrequencyHz.toFixed(2)
        : 'N/A';
    } else {
      this.refs.inspectorFemaleRankRow.hidden = true;
      this.refs.inspectorFemaleRank.textContent = 'N/A';
      this.refs.inspectorSwayRow.hidden = true;
      this.refs.inspectorSwayAmplitude.textContent = 'N/A';
      this.refs.inspectorSwayFrequency.textContent = 'N/A';
    }

    if (shape.kind === 'polygon' && (shape.irregular ?? false)) {
      this.refs.inspectorIrregularRow.hidden = false;
      this.refs.inspectorIrregularState.textContent = 'Regularizing...';
      const deviationDeg = irregularity?.angleDeviationDeg ?? shape.maxDeviationDeg;
      if (Number.isFinite(deviationDeg)) {
        this.refs.inspectorIrregularDeviation.textContent = `${(deviationDeg ?? 0).toFixed(2)}°`;
      } else {
        const deviation = irregularity?.deviation ?? shape.irregularity;
        this.refs.inspectorIrregularDeviation.textContent = Number.isFinite(deviation)
          ? deviation.toFixed(4)
          : 'N/A';
      }
    } else if (shape.kind === 'polygon') {
      this.refs.inspectorIrregularRow.hidden = false;
      this.refs.inspectorIrregularState.textContent = 'No';
      this.refs.inspectorIrregularDeviation.textContent = 'N/A';
    } else {
      this.refs.inspectorIrregularRow.hidden = true;
      this.refs.inspectorIrregularState.textContent = 'N/A';
      this.refs.inspectorIrregularDeviation.textContent = 'N/A';
    }

    this.updateInspectorFieldVisibility();
  }

  private renderKnownList(knowledge: KnowledgeComponent): void {
    this.refs.inspectorKnownList.innerHTML = '';

    const knownEntries = [...knowledge.known.entries()].sort((left, right) => {
      const leftInfo = left[1];
      const rightInfo = right[1];
      if (leftInfo.learnedAtTick !== rightInfo.learnedAtTick) {
        return rightInfo.learnedAtTick - leftInfo.learnedAtTick;
      }
      return left[0] - right[0];
    });

    const recent = knownEntries.slice(0, 5);
    if (recent.length === 0) {
      const empty = document.createElement('li');
      empty.textContent = 'No known contacts';
      this.refs.inspectorKnownList.appendChild(empty);
      return;
    }

    for (const [id, info] of recent) {
      const item = document.createElement('li');
      item.textContent = `#${id}: ${info.rank} (t${info.learnedAtTick})`;
      this.refs.inspectorKnownList.appendChild(item);
    }
  }

  private wireControls(): void {
    this.refs.runButton.addEventListener('click', () => {
      const running = this.callbacks.onToggleRun();
      this.refs.runButton.textContent = running ? 'Pause' : 'Start';
    });

    this.refs.stepButton.addEventListener('click', () => {
      this.callbacks.onStep();
    });

    this.refs.resetButton.addEventListener('click', () => {
      const seed = parseInteger(this.refs.seedInput.value, 1);
      this.refs.runButton.textContent = 'Start';
      this.callbacks.onReset(seed);
    });

    this.refs.novelSafetyPresetButton.addEventListener('click', () => {
      this.applyNovelSafetyPresetInputs();
      this.callbacks.onApplyNovelSafetyPreset();
    });

    this.refs.harmonicMotionPresetButton.addEventListener('click', () => {
      this.applyHarmonicMotionPresetInputs();
      this.callbacks.onApplyHarmonicMotionPreset();
    });

    this.refs.worldTopology.addEventListener('input', () => {
      const topology = this.readTopology();
      this.syncBoundaryControlsToTopology(topology);
      this.callbacks.onTopologyUpdate(topology);
    });
    this.refs.worldTopology.addEventListener('change', () => {
      const topology = this.readTopology();
      this.syncBoundaryControlsToTopology(topology);
      this.callbacks.onTopologyUpdate(topology);
    });

    const environmentInputs: Array<HTMLInputElement> = [
      this.refs.envHousesEnabled,
      this.refs.envHouseCount,
      this.refs.envTownPopulation,
      this.refs.envAllowTriangularForts,
      this.refs.envAllowSquareHouses,
      this.refs.envHouseSize,
    ];

    for (const input of environmentInputs) {
      input.addEventListener('input', () => {
        const settings = this.readEnvironmentSettings();
        this.syncEnvironmentFieldState(settings);
        this.callbacks.onEnvironmentUpdate(settings);
      });
      input.addEventListener('change', () => {
        const settings = this.readEnvironmentSettings();
        this.syncEnvironmentFieldState(settings);
        this.callbacks.onEnvironmentUpdate(settings);
      });
    }

    const peaceCryDefaultInputs: Array<HTMLInputElement> = [
      this.refs.peaceCryEnabledGlobal,
      this.refs.peaceCryCadenceGlobal,
      this.refs.peaceCryRadiusGlobal,
    ];

    for (const input of peaceCryDefaultInputs) {
      input.addEventListener('input', () => {
        this.callbacks.onPeaceCryDefaultsUpdate(this.readPeaceCrySettings());
      });
      input.addEventListener('change', () => {
        this.callbacks.onPeaceCryDefaultsUpdate(this.readPeaceCrySettings());
      });
    }

    this.refs.peaceCryApplyAllButton.addEventListener('click', () => {
      this.callbacks.onApplyPeaceCryDefaultsToWomen();
    });

    const reproductionInputs: Array<HTMLInputElement> = [
      this.refs.reproductionEnabled,
      this.refs.reproductionGestationTicks,
      this.refs.reproductionMatingRadius,
      this.refs.reproductionConceptionChance,
      this.refs.reproductionFemaleBirthProbability,
      this.refs.reproductionMaxPopulation,
      this.refs.reproductionIrregularEnabled,
      this.refs.reproductionIrregularBaseChance,
    ];

    for (const input of reproductionInputs) {
      input.addEventListener('input', () => {
        this.callbacks.onReproductionUpdate(this.readReproductionSettings());
      });
      input.addEventListener('change', () => {
        this.callbacks.onReproductionUpdate(this.readReproductionSettings());
      });
    }

    const eventHighlightInputs: Array<HTMLInputElement> = [
      this.refs.eventHighlightsEnabled,
      this.refs.eventHighlightsIntensity,
      this.refs.eventHighlightsCap,
      this.refs.eventShowFeeling,
      this.refs.eventFocusSelected,
      this.refs.eventShowHearing,
      this.refs.eventShowTalking,
      this.refs.eventStrokeKills,
      this.refs.overlayContactNetwork,
      this.refs.overlayNetworkParents,
      this.refs.overlayNetworkKnown,
      this.refs.overlayNetworkMaxKnown,
      this.refs.overlayNetworkOnScreen,
      this.refs.overlayNetworkFocusRadius,
      this.refs.overlayDimAge,
      this.refs.overlayDimDeterioration,
      this.refs.overlayDimStrength,
      this.refs.overlayFogPreview,
      this.refs.overlayFogPreviewStrength,
      this.refs.overlayFogPreviewHideMin,
      this.refs.overlayFogRings,
    ];

    for (const input of eventHighlightInputs) {
      input.addEventListener('input', () => {
        this.callbacks.onEventHighlightsUpdate(this.readEventHighlightsSettings());
      });
      input.addEventListener('change', () => {
        this.callbacks.onEventHighlightsUpdate(this.readEventHighlightsSettings());
      });
    }

    this.refs.eventHighlightsClearButton.addEventListener('click', () => {
      this.callbacks.onClearEventHighlights();
    });

    const flatlanderInputs: Array<HTMLInputElement | HTMLSelectElement> = [
      this.refs.flatlanderEnabled,
      this.refs.flatlanderRays,
      this.refs.flatlanderFov,
      this.refs.flatlanderLookOffset,
      this.refs.flatlanderMaxDistance,
      this.refs.flatlanderFogDensity,
      this.refs.flatlanderGrayscale,
      this.refs.flatlanderIncludeObstacles,
    ];

    for (const input of flatlanderInputs) {
      input.addEventListener('input', () => {
        this.callbacks.onFlatlanderViewUpdate(this.readFlatlanderViewSettings());
      });
      input.addEventListener('change', () => {
        this.callbacks.onFlatlanderViewUpdate(this.readFlatlanderViewSettings());
      });
    }

    const fogSightInputs: Array<HTMLInputElement> = [this.refs.fogSightEnabled, this.refs.fogSightDensity];
    for (const input of fogSightInputs) {
      input.addEventListener('input', () => {
        this.callbacks.onFogSightUpdate(this.readFogSightSettings());
      });
      input.addEventListener('change', () => {
        this.callbacks.onFogSightUpdate(this.readFogSightSettings());
      });
    }

    this.refs.eventHighlightsShowLegend.addEventListener('input', () => {
      this.syncLegendVisibility();
    });
    this.refs.eventHighlightsShowLegend.addEventListener('change', () => {
      this.syncLegendVisibility();
    });

    this.refs.spawnButton.addEventListener('click', () => {
      const request = this.readSpawnRequest();
      this.callbacks.onSpawn(request);
    });

    const southInputs: Array<HTMLInputElement> = [
      this.refs.southEnabled,
      this.refs.southStrength,
      this.refs.southWomenMultiplier,
      this.refs.southZoneStart,
      this.refs.southZoneEnd,
      this.refs.southDrag,
      this.refs.southMaxTerminal,
      this.refs.southEscapeFraction,
      this.refs.southShowZone,
      this.refs.southShowClickDebug,
    ];

    for (const input of southInputs) {
      input.addEventListener('input', () => {
        this.callbacks.onSouthAttractionUpdate(this.readSouthAttractionSettings());
      });
      input.addEventListener('change', () => {
        this.callbacks.onSouthAttractionUpdate(this.readSouthAttractionSettings());
      });
    }

    this.refs.spawnShape.addEventListener('change', () => this.updateSpawnFieldVisibility());
    this.refs.spawnMovementType.addEventListener('change', () => this.updateSpawnFieldVisibility());
    this.refs.spawnSides.addEventListener('input', () => this.updateSpawnFieldVisibility());
    this.refs.spawnTriangleKind.addEventListener('change', () => this.updateSpawnFieldVisibility());
    this.refs.spawnMimicryEnabled.addEventListener('input', () => this.updateSpawnFieldVisibility());
    this.refs.spawnMimicryEnabled.addEventListener('change', () => this.updateSpawnFieldVisibility());

    this.refs.inspectorMovementType.addEventListener('change', () => {
      this.updateInspectorFieldVisibility();
      this.emitInspectorUpdate();
    });

    const inspectorInputs: Array<HTMLInputElement | HTMLSelectElement> = [
      this.refs.inspectorSpeed,
      this.refs.inspectorTurnRate,
      this.refs.inspectorDecisionTicks,
      this.refs.inspectorIntentionMinTicks,
      this.refs.inspectorVx,
      this.refs.inspectorVy,
      this.refs.inspectorTargetX,
      this.refs.inspectorTargetY,
      this.refs.inspectorMovementType,
    ];

    for (const input of inspectorInputs) {
      input.addEventListener('input', () => this.emitInspectorUpdate());
      input.addEventListener('change', () => this.emitInspectorUpdate());
    }

    const visionInputs: Array<HTMLInputElement> = [
      this.refs.inspectorVisionEnabled,
      this.refs.inspectorVisionRange,
      this.refs.inspectorAvoidDistance,
    ];

    for (const input of visionInputs) {
      input.addEventListener('input', () => this.emitInspectorVisionUpdate());
      input.addEventListener('change', () => this.emitInspectorVisionUpdate());
    }

    const perceptionInputs: Array<HTMLInputElement> = [
      this.refs.inspectorHearingSkill,
      this.refs.inspectorHearingRadius,
    ];
    for (const input of perceptionInputs) {
      input.addEventListener('input', () => this.emitInspectorPerceptionUpdate());
      input.addEventListener('change', () => this.emitInspectorPerceptionUpdate());
    }

    const voiceInputs: Array<HTMLInputElement | HTMLSelectElement> = [
      this.refs.inspectorVoiceEnabled,
      this.refs.inspectorVoiceSignature,
    ];
    for (const input of voiceInputs) {
      input.addEventListener('input', () => this.emitInspectorVoiceUpdate());
      input.addEventListener('change', () => this.emitInspectorVoiceUpdate());
    }

    const peaceCryInputs: Array<HTMLInputElement> = [
      this.refs.inspectorPeaceCryEnabled,
      this.refs.inspectorPeaceCryCadence,
      this.refs.inspectorPeaceCryRadius,
    ];

    for (const input of peaceCryInputs) {
      input.addEventListener('input', () => this.emitInspectorPeaceCryUpdate());
      input.addEventListener('change', () => this.emitInspectorPeaceCryUpdate());
    }

    const feelingInputs: Array<HTMLInputElement> = [
      this.refs.inspectorFeelingEnabled,
      this.refs.inspectorFeelCooldown,
      this.refs.inspectorApproachSpeed,
    ];

    for (const input of feelingInputs) {
      input.addEventListener('input', () => this.emitInspectorFeelingUpdate());
      input.addEventListener('change', () => this.emitInspectorFeelingUpdate());
    }
  }

  private readSouthAttractionSettings(): SouthAttractionSettings {
    const zoneStart = clampRange(parseNumber(this.refs.southZoneStart.value, 0.75), 0, 1);
    const zoneEnd = clampRange(parseNumber(this.refs.southZoneEnd.value, 0.95), 0, 1);

    return {
      enabled: this.refs.southEnabled.checked,
      strength: clampPositive(parseNumber(this.refs.southStrength.value, 2)),
      womenMultiplier: clampPositive(parseNumber(this.refs.southWomenMultiplier.value, 2)),
      zoneStartFrac: Math.min(zoneStart, zoneEnd),
      zoneEndFrac: Math.max(zoneStart, zoneEnd),
      drag: clampPositive(parseNumber(this.refs.southDrag.value, 12)),
      maxTerminal: clampPositive(parseNumber(this.refs.southMaxTerminal.value, 1.8)),
      escapeFraction: clampRange(parseNumber(this.refs.southEscapeFraction.value, 0.5), 0, 1),
      showSouthZoneOverlay: this.refs.southShowZone.checked,
      showClickDebug: this.refs.southShowClickDebug.checked,
    };
  }

  private applyNovelSafetyPresetInputs(): void {
    this.refs.spawnSpeed.value = '18';
    this.refs.spawnTurnRate.value = '1.8';
    this.refs.spawnDecisionTicks.value = '18';
    this.refs.spawnIntentionMinTicks.value = '80';
    this.refs.spawnVx.value = '12';
    this.refs.spawnVy.value = '0';
    this.refs.spawnFeelingEnabled.checked = true;
    this.refs.spawnFeelCooldown.value = '20';
    this.refs.spawnApproachSpeed.value = '9';

    this.refs.inspectorAvoidDistance.value = '55';

    this.refs.peaceCryEnabledGlobal.checked = true;
    this.refs.peaceCryCadenceGlobal.value = '16';
    this.refs.peaceCryRadiusGlobal.value = '150';

    this.refs.reproductionEnabled.checked = true;
    this.refs.reproductionGestationTicks.value = '220';
    this.refs.reproductionMatingRadius.value = '65';
    this.refs.reproductionConceptionChance.value = '0.0042';
    this.refs.reproductionFemaleBirthProbability.value = '0.56';
    this.refs.reproductionMaxPopulation.value = '550';
    this.refs.reproductionIrregularEnabled.checked = true;
    this.refs.reproductionIrregularBaseChance.value = '0.02';

    this.refs.southEnabled.checked = true;
    this.refs.southStrength.value = '2';
    this.refs.southWomenMultiplier.value = '2.2';
    this.refs.southDrag.value = '12';
    this.refs.southMaxTerminal.value = '1.8';
    this.refs.southEscapeFraction.value = '0.5';
    this.refs.fogSightEnabled.checked = true;
    this.refs.fogSightDensity.value = '0.006';

    this.callbacks.onPeaceCryDefaultsUpdate(this.readPeaceCrySettings());
    this.callbacks.onReproductionUpdate(this.readReproductionSettings());
    this.callbacks.onFogSightUpdate(this.readFogSightSettings());
    this.callbacks.onSouthAttractionUpdate(this.readSouthAttractionSettings());
  }

  private applyHarmonicMotionPresetInputs(): void {
    this.refs.spawnMovementType.value = 'socialNav';
    this.refs.spawnSpeed.value = '14';
    this.refs.spawnTurnRate.value = '1.2';
    this.refs.spawnDecisionTicks.value = '20';
    this.refs.spawnIntentionMinTicks.value = '90';
    this.refs.inspectorMovementType.value = 'socialNav';
    this.refs.inspectorSpeed.value = '14';
    this.refs.inspectorTurnRate.value = '1.2';
    this.refs.inspectorDecisionTicks.value = '20';
    this.refs.inspectorIntentionMinTicks.value = '90';
    this.updateSpawnFieldVisibility();
    this.updateInspectorFieldVisibility();
  }

  private readEnvironmentSettings(): EnvironmentSettings {
    return {
      housesEnabled: false,
      houseCount: 0,
      townPopulation: Math.max(0, parseInteger(this.refs.envTownPopulation.value, 5000)),
      allowTriangularForts: false,
      allowSquareHouses: false,
      houseSize: Math.max(4, parseNumber(this.refs.envHouseSize.value, 30)),
    };
  }

  private syncEnvironmentFieldState(settings: EnvironmentSettings): void {
    void settings;
    this.refs.envHousesEnabled.checked = false;
    this.refs.envHousesEnabled.disabled = true;
    this.refs.envHouseCount.value = '0';
    this.refs.envHouseCount.disabled = true;
    this.refs.envAllowTriangularForts.checked = false;
    this.refs.envAllowTriangularForts.disabled = true;
    this.refs.envAllowSquareHouses.checked = false;
    this.refs.envAllowSquareHouses.disabled = true;
  }

  private readPeaceCrySettings(): PeaceCrySettings {
    return {
      enabled: this.refs.peaceCryEnabledGlobal.checked,
      cadenceTicks: Math.max(1, parseInteger(this.refs.peaceCryCadenceGlobal.value, 20)),
      radius: Math.max(0, parseNumber(this.refs.peaceCryRadiusGlobal.value, 120)),
    };
  }

  private readReproductionSettings(): ReproductionSettings {
    return {
      enabled: this.refs.reproductionEnabled.checked,
      gestationTicks: Math.max(1, parseInteger(this.refs.reproductionGestationTicks.value, 300)),
      matingRadius: Math.max(0, parseNumber(this.refs.reproductionMatingRadius.value, 52)),
      conceptionChancePerTick: clampRange(
        parseNumber(this.refs.reproductionConceptionChance.value, 0.0027),
        0,
        1,
      ),
      femaleBirthProbability: clampRange(
        parseNumber(this.refs.reproductionFemaleBirthProbability.value, 0.54),
        0,
        1,
      ),
      maxPopulation: Math.max(1, parseInteger(this.refs.reproductionMaxPopulation.value, 400)),
      irregularBirthsEnabled: this.refs.reproductionIrregularEnabled.checked,
      irregularBirthBaseChance: clampRange(
        parseNumber(this.refs.reproductionIrregularBaseChance.value, 0.02),
        0,
        1,
      ),
    };
  }

  private readEventHighlightsSettings(): EventHighlightsSettings {
    return {
      enabled: this.refs.eventHighlightsEnabled.checked,
      intensity: Math.max(0, parseNumber(this.refs.eventHighlightsIntensity.value, 1)),
      capPerTick: Math.max(1, parseInteger(this.refs.eventHighlightsCap.value, 120)),
      showFeeling: this.refs.eventShowFeeling.checked,
      focusOnSelected: this.refs.eventFocusSelected.checked,
      showHearingOverlay: this.refs.eventShowHearing.checked,
      showTalkingOverlay: this.refs.eventShowTalking.checked,
      strokeByKills: this.refs.eventStrokeKills.checked,
      showContactNetwork: this.refs.overlayContactNetwork.checked,
      networkShowParents: this.refs.overlayNetworkParents.checked,
      networkShowKnown: this.refs.overlayNetworkKnown.checked,
      networkMaxKnownEdges: Math.max(0, parseInteger(this.refs.overlayNetworkMaxKnown.value, 25)),
      networkShowOnlyOnScreen: this.refs.overlayNetworkOnScreen.checked,
      networkFocusRadius: Math.max(0, parseNumber(this.refs.overlayNetworkFocusRadius.value, 400)),
      dimByAge: this.refs.overlayDimAge.checked,
      dimByDeterioration: this.refs.overlayDimDeterioration.checked,
      dimStrength: clampRange(parseNumber(this.refs.overlayDimStrength.value, 0.25), 0, 1),
      fogPreviewEnabled: this.refs.overlayFogPreview.checked,
      fogPreviewStrength: clampRange(parseNumber(this.refs.overlayFogPreviewStrength.value, 0.2), 0, 1),
      fogPreviewHideBelowMin: this.refs.overlayFogPreviewHideMin.checked,
      fogPreviewRings: this.refs.overlayFogRings.checked,
    };
  }

  private readFlatlanderViewSettings(): FlatlanderViewSettings {
    const rays = Math.max(16, parseInteger(this.refs.flatlanderRays.value, 720));
    const fovDeg = clampRange(parseNumber(this.refs.flatlanderFov.value, 360), 30, 360);
    const lookOffsetDeg = clampRange(parseNumber(this.refs.flatlanderLookOffset.value, 0), -180, 180);

    return {
      enabled: this.refs.flatlanderEnabled.checked,
      rays,
      fovRad: (fovDeg * Math.PI) / 180,
      lookOffsetRad: (lookOffsetDeg * Math.PI) / 180,
      maxDistance: Math.max(1, parseNumber(this.refs.flatlanderMaxDistance.value, 400)),
      fogDensity: Math.max(0, parseNumber(this.refs.flatlanderFogDensity.value, 0.006)),
      minVisibleIntensity: 0.06,
      grayscaleMode: this.refs.flatlanderGrayscale.checked,
      includeObstacles: this.refs.flatlanderIncludeObstacles.checked,
      inanimateDimMultiplier: 0.65,
    };
  }

  private readFogSightSettings(): FogSightSettings {
    return {
      sightEnabled: this.refs.fogSightEnabled.checked,
      fogDensity: Math.max(0, parseNumber(this.refs.fogSightDensity.value, 0.006)),
    };
  }

  private syncLegendVisibility(): void {
    this.refs.legendPanel.hidden = !this.refs.eventHighlightsShowLegend.checked;
  }

  private readSpawnRequest(): SpawnRequest {
    const shapeType = this.refs.spawnShape.value;
    const femaleRank = clampFemaleRank(this.refs.spawnFemaleRank.value);

    let shape: SpawnRequest['shape'];
    if (shapeType === 'segment') {
      shape = {
        kind: 'segment',
        size: parseNumber(this.refs.spawnSize.value, 30),
      };
    } else if (shapeType === 'circle') {
      shape = {
        kind: 'circle',
        size: parseNumber(this.refs.spawnSize.value, 20),
      };
    } else {
      const sides = parseInteger(this.refs.spawnSides.value, 6);
      const base: SpawnRequest['shape'] = {
        kind: 'polygon',
        size: parseNumber(this.refs.spawnSize.value, 24),
        sides,
        irregular: this.refs.spawnIrregular.checked,
      };

      if (sides === 3) {
        const triangleKind = parseTriangleKind(this.refs.spawnTriangleKind.value);
        base.triangleKind = triangleKind;
        base.irregular = false;

        if (triangleKind === 'Isosceles') {
          base.isoscelesBaseRatio = clampRange(
            parseNumber(this.refs.spawnBaseRatio.value, DEFAULT_ISOSCELES_BASE_RATIO),
            MIN_ISOSCELES_BASE_RATIO,
            MAX_ISOSCELES_BASE_RATIO,
          );
        }
      }

      shape = base;
    }

    const isIsoscelesTriangle =
      shape.kind === 'polygon' && shape.sides === 3 && shape.triangleKind === 'Isosceles';
    const voice: SpawnRequest['voice'] = isIsoscelesTriangle
      ? {
          mimicryEnabled: this.refs.spawnMimicryEnabled.checked,
          mimicrySignature: parseVoiceSignature(this.refs.spawnMimicrySignature.value),
        }
      : undefined;
    const femaleStatus: SpawnFemaleStatusConfig | undefined =
      shape.kind === 'segment'
        ? {
            femaleRank,
          }
        : undefined;

    const movement = this.readSpawnMovement(
      this.refs.spawnMovementType.value,
      boundaryFromTopology(this.readTopology()),
      this.refs.spawnSpeed,
      this.refs.spawnTurnRate,
      this.refs.spawnDecisionTicks,
      this.refs.spawnIntentionMinTicks,
      this.refs.spawnVx,
      this.refs.spawnVy,
      this.refs.spawnTargetX,
      this.refs.spawnTargetY,
    );

    return {
      shape,
      movement,
      count: Math.max(1, parseInteger(this.refs.spawnCount.value, 1)),
      ...(voice ? { voice } : {}),
      ...(femaleStatus ? { femaleStatus } : {}),
      feeling: {
        enabled: this.refs.spawnFeelingEnabled.checked,
        feelCooldownTicks: Math.max(0, parseInteger(this.refs.spawnFeelCooldown.value, 30)),
        approachSpeed: Math.max(0, parseNumber(this.refs.spawnApproachSpeed.value, 10)),
      },
    };
  }

  private emitInspectorUpdate(): void {
    if (this.selectedEntityId === null) {
      return;
    }

    const movement = this.readSpawnMovement(
      this.refs.inspectorMovementType.value,
      boundaryFromTopology(this.readTopology()),
      this.refs.inspectorSpeed,
      this.refs.inspectorTurnRate,
      this.refs.inspectorDecisionTicks,
      this.refs.inspectorIntentionMinTicks,
      this.refs.inspectorVx,
      this.refs.inspectorVy,
      this.refs.inspectorTargetX,
      this.refs.inspectorTargetY,
    );

    this.callbacks.onInspectorUpdate(movement);
  }

  private emitInspectorVisionUpdate(): void {
    if (this.selectedEntityId === null) {
      return;
    }

    this.callbacks.onInspectorVisionUpdate({
      enabled: this.refs.inspectorVisionEnabled.checked,
      range: Math.max(0, parseNumber(this.refs.inspectorVisionRange.value, 120)),
      avoidDistance: Math.max(0, parseNumber(this.refs.inspectorAvoidDistance.value, 40)),
    });
  }

  private emitInspectorPerceptionUpdate(): void {
    if (this.selectedEntityId === null) {
      return;
    }

    this.callbacks.onInspectorPerceptionUpdate({
      hearingSkill: clampRange(parseNumber(this.refs.inspectorHearingSkill.value, 0.5), 0, 1),
      hearingRadius: Math.max(0, parseNumber(this.refs.inspectorHearingRadius.value, 180)),
    });
  }

  private emitInspectorVoiceUpdate(): void {
    if (this.selectedEntityId === null || this.refs.inspectorVoiceRow.hidden) {
      return;
    }

    this.callbacks.onInspectorVoiceUpdate({
      mimicryEnabled: this.refs.inspectorVoiceEnabled.checked,
      mimicrySignature: parseVoiceSignature(this.refs.inspectorVoiceSignature.value),
    });
  }

  private emitInspectorPeaceCryUpdate(): void {
    if (this.selectedEntityId === null || this.refs.inspectorPeaceCryRow.hidden) {
      return;
    }

    this.callbacks.onInspectorPeaceCryUpdate({
      enabled: this.refs.inspectorPeaceCryEnabled.checked,
      cadenceTicks: Math.max(1, parseInteger(this.refs.inspectorPeaceCryCadence.value, 20)),
      radius: Math.max(0, parseNumber(this.refs.inspectorPeaceCryRadius.value, 120)),
    });
  }

  private emitInspectorFeelingUpdate(): void {
    if (this.selectedEntityId === null) {
      return;
    }

    this.callbacks.onInspectorFeelingUpdate({
      enabled: this.refs.inspectorFeelingEnabled.checked,
      feelCooldownTicks: Math.max(0, parseInteger(this.refs.inspectorFeelCooldown.value, 30)),
      approachSpeed: Math.max(0, parseNumber(this.refs.inspectorApproachSpeed.value, 10)),
    });
  }

  private updateSpawnFieldVisibility(): void {
    const shapeType = this.refs.spawnShape.value;
    const movementType = this.refs.spawnMovementType.value;
    const sides = parseInteger(this.refs.spawnSides.value, 6);
    const isTrianglePolygon = shapeType === 'polygon' && sides === 3;
    const triangleKind = parseTriangleKind(this.refs.spawnTriangleKind.value);
    const isIsosceles = isTrianglePolygon && triangleKind === 'Isosceles';

    this.refs.spawnSidesRow.hidden = shapeType !== 'polygon';
    this.refs.spawnIrregularRow.hidden = shapeType !== 'polygon' || isTrianglePolygon;
    this.refs.spawnTriangleKindRow.hidden = !isTrianglePolygon;
    this.refs.spawnBaseRatioRow.hidden = !isIsosceles;
    this.refs.spawnMimicryRow.hidden = !isIsosceles;
    this.refs.spawnMimicrySignatureRow.hidden = !isIsosceles || !this.refs.spawnMimicryEnabled.checked;
    this.refs.spawnFemaleRankRow.hidden = shapeType !== 'segment';

    this.refs.spawnSpeedRow.hidden = movementType === 'straightDrift';
    this.refs.spawnTurnRateRow.hidden = movementType === 'straightDrift';
    this.refs.spawnSocialDecisionRow.hidden = movementType !== 'socialNav';
    this.refs.spawnSocialIntentionRow.hidden = movementType !== 'socialNav';
    this.refs.spawnDriftRow.hidden = movementType !== 'straightDrift';
    this.refs.spawnTargetRow.hidden = movementType !== 'seekPoint';
  }

  private updateInspectorFieldVisibility(): void {
    const movementType = this.refs.inspectorMovementType.value;

    this.refs.inspectorSpeedRow.hidden = movementType === 'straightDrift';
    this.refs.inspectorTurnRateRow.hidden = movementType === 'straightDrift';
    this.refs.inspectorSocialRow.hidden = movementType !== 'socialNav';
    this.refs.inspectorDriftRow.hidden = movementType !== 'straightDrift';
    this.refs.inspectorTargetRow.hidden = movementType !== 'seekPoint';
  }

  private readSpawnMovement(
    movementType: string,
    boundary: SpawnMovementConfig['boundary'],
    speedInput: HTMLInputElement,
    turnRateInput: HTMLInputElement,
    decisionEveryTicksInput: HTMLInputElement,
    intentionMinTicksInput: HTMLInputElement,
    vxInput: HTMLInputElement,
    vyInput: HTMLInputElement,
    targetXInput: HTMLInputElement,
    targetYInput: HTMLInputElement,
  ): SpawnMovementConfig {
    if (movementType === 'straightDrift') {
      return {
        type: 'straightDrift',
        boundary,
        vx: parseNumber(vxInput.value, 40),
        vy: parseNumber(vyInput.value, 0),
      };
    }

    if (movementType === 'seekPoint') {
      return {
        type: 'seekPoint',
        boundary,
        speed: parseNumber(speedInput.value, 35),
        turnRate: parseNumber(turnRateInput.value, 2),
        target: {
          x: parseNumber(targetXInput.value, 500),
          y: parseNumber(targetYInput.value, 350),
        },
      };
    }

    if (movementType === 'socialNav') {
      return {
        type: 'socialNav',
        boundary,
        maxSpeed: Math.max(0.1, parseNumber(speedInput.value, 14)),
        maxTurnRate: Math.max(0.1, parseNumber(turnRateInput.value, 1.2)),
        decisionEveryTicks: Math.max(1, parseInteger(decisionEveryTicksInput.value, 18)),
        intentionMinTicks: Math.max(1, parseInteger(intentionMinTicksInput.value, 80)),
      };
    }

    return {
      type: 'randomWalk',
      boundary,
      speed: parseNumber(speedInput.value, 25),
      turnRate: parseNumber(turnRateInput.value, 2),
    };
  }

  private readTopology(): WorldTopology {
    return this.refs.worldTopology.value === 'bounded' ? 'bounded' : 'torus';
  }

  private syncBoundaryControlsToTopology(topology: WorldTopology): void {
    const boundary = boundaryFromTopology(topology);
    this.refs.spawnBoundary.value = boundary;
    this.refs.inspectorBoundary.value = boundary;
  }
}

function rankLabel(rank: RankComponent, shape: ShapeComponent): string {
  if (rank.rank === Rank.Triangle && shape.kind === 'polygon') {
    return shape.triangleKind === 'Isosceles' ? 'Triangle (Isosceles)' : 'Triangle (Equilateral)';
  }
  return rank.rank;
}

function shapeLabel(shape: ShapeComponent): string {
  if (shape.kind === 'segment') {
    return `Segment length=${shape.length.toFixed(1)}`;
  }

  if (shape.kind === 'circle') {
    return `Circle radius=${shape.radius.toFixed(1)}`;
  }

  return `${shape.sides}-gon${shape.sides === 3 && shape.triangleKind ? ` (${shape.triangleKind})` : ''}`;
}

function parseTriangleKind(value: string): TriangleKind {
  return value === 'Isosceles' ? 'Isosceles' : 'Equilateral';
}

function parseVoiceSignature(value: string): VoiceSignature {
  if (value === 'Square' || value === 'Pentagon' || value === 'HighOrder' || value === 'Equilateral') {
    return value;
  }
  return 'Square';
}

function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampPositive(value: number): number {
  return Math.max(0, value);
}

function parseNumber(raw: string, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function parseInteger(raw: string, fallback: number): number {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function collectRefs(): InputRefs {
  return {
    runButton: required<HTMLButtonElement>('run-btn'),
    stepButton: required<HTMLButtonElement>('step-btn'),
    resetButton: required<HTMLButtonElement>('reset-btn'),
    novelSafetyPresetButton: required<HTMLButtonElement>('novel-safety-preset-btn'),
    harmonicMotionPresetButton: required<HTMLButtonElement>('harmonic-motion-preset-btn'),
    seedInput: required<HTMLInputElement>('seed-input'),
    worldTopology: required<HTMLSelectElement>('world-topology'),
    envHousesEnabled: required<HTMLInputElement>('env-houses-enabled'),
    envHouseCount: required<HTMLInputElement>('env-house-count'),
    envTownPopulation: required<HTMLInputElement>('env-town-population'),
    envAllowTriangularForts: required<HTMLInputElement>('env-allow-triangular-forts'),
    envAllowSquareHouses: required<HTMLInputElement>('env-allow-square-houses'),
    envHouseSize: required<HTMLInputElement>('env-house-size'),
    peaceCryEnabledGlobal: required<HTMLInputElement>('peace-cry-enabled'),
    peaceCryCadenceGlobal: required<HTMLInputElement>('peace-cry-cadence'),
    peaceCryRadiusGlobal: required<HTMLInputElement>('peace-cry-radius'),
    peaceCryApplyAllButton: required<HTMLButtonElement>('peace-cry-apply-all'),
    reproductionEnabled: required<HTMLInputElement>('reproduction-enabled'),
    reproductionGestationTicks: required<HTMLInputElement>('reproduction-gestation-ticks'),
    reproductionMatingRadius: required<HTMLInputElement>('reproduction-mating-radius'),
    reproductionConceptionChance: required<HTMLInputElement>('reproduction-conception-chance'),
    reproductionFemaleBirthProbability: required<HTMLInputElement>('reproduction-female-birth-probability'),
    reproductionMaxPopulation: required<HTMLInputElement>('reproduction-max-population'),
    reproductionIrregularEnabled: required<HTMLInputElement>('reproduction-irregular-enabled'),
    reproductionIrregularBaseChance: required<HTMLInputElement>('reproduction-irregular-base-chance'),
    eventHighlightsEnabled: required<HTMLInputElement>('event-highlights-enabled'),
    eventHighlightsShowLegend: required<HTMLInputElement>('event-highlights-show-legend'),
    eventHighlightsIntensity: required<HTMLInputElement>('event-highlights-intensity'),
    eventHighlightsCap: required<HTMLInputElement>('event-highlights-cap'),
    eventShowFeeling: required<HTMLInputElement>('event-show-feeling'),
    eventFocusSelected: required<HTMLInputElement>('event-focus-selected'),
    eventShowHearing: required<HTMLInputElement>('event-show-hearing'),
    eventShowTalking: required<HTMLInputElement>('event-show-talking'),
    eventStrokeKills: required<HTMLInputElement>('event-stroke-kills'),
    overlayContactNetwork: required<HTMLInputElement>('overlay-contact-network'),
    overlayNetworkParents: required<HTMLInputElement>('overlay-network-parents'),
    overlayNetworkKnown: required<HTMLInputElement>('overlay-network-known'),
    overlayNetworkMaxKnown: required<HTMLInputElement>('overlay-network-max-known'),
    overlayNetworkOnScreen: required<HTMLInputElement>('overlay-network-on-screen'),
    overlayNetworkFocusRadius: required<HTMLInputElement>('overlay-network-focus-radius'),
    overlayDimAge: required<HTMLInputElement>('overlay-dim-age'),
    overlayDimDeterioration: required<HTMLInputElement>('overlay-dim-deterioration'),
    overlayDimStrength: required<HTMLInputElement>('overlay-dim-strength'),
    overlayFogPreview: required<HTMLInputElement>('overlay-fog-preview'),
    overlayFogPreviewStrength: required<HTMLInputElement>('overlay-fog-preview-strength'),
    overlayFogPreviewHideMin: required<HTMLInputElement>('overlay-fog-preview-hide-min'),
    overlayFogRings: required<HTMLInputElement>('overlay-fog-rings'),
    eventHighlightsClearButton: required<HTMLButtonElement>('event-highlights-clear'),
    flatlanderEnabled: required<HTMLInputElement>('flatlander-enabled'),
    flatlanderRays: required<HTMLSelectElement>('flatlander-rays'),
    flatlanderFov: required<HTMLSelectElement>('flatlander-fov'),
    flatlanderLookOffset: required<HTMLInputElement>('flatlander-look-offset'),
    flatlanderMaxDistance: required<HTMLInputElement>('flatlander-max-distance'),
    flatlanderFogDensity: required<HTMLInputElement>('flatlander-fog-density'),
    flatlanderGrayscale: required<HTMLInputElement>('flatlander-grayscale'),
    flatlanderIncludeObstacles: required<HTMLInputElement>('flatlander-include-obstacles'),
    fogSightEnabled: required<HTMLInputElement>('fog-sight-enabled'),
    fogSightDensity: required<HTMLInputElement>('fog-sight-density'),
    legendPanel: required<HTMLElement>('legend-panel'),
    southEnabled: required<HTMLInputElement>('south-enabled'),
    southStrength: required<HTMLInputElement>('south-strength'),
    southWomenMultiplier: required<HTMLInputElement>('south-women-multiplier'),
    southZoneStart: required<HTMLInputElement>('south-zone-start'),
    southZoneEnd: required<HTMLInputElement>('south-zone-end'),
    southDrag: required<HTMLInputElement>('south-drag'),
    southMaxTerminal: required<HTMLInputElement>('south-max-terminal'),
    southEscapeFraction: required<HTMLInputElement>('south-escape-fraction'),
    southShowZone: required<HTMLInputElement>('south-show-zone'),
    southShowClickDebug: required<HTMLInputElement>('south-show-click-debug'),
    spawnButton: required<HTMLButtonElement>('spawn-btn'),
    spawnShape: required<HTMLSelectElement>('spawn-shape'),
    spawnSides: required<HTMLInputElement>('spawn-sides'),
    spawnIrregular: required<HTMLInputElement>('spawn-irregular'),
    spawnTriangleKind: required<HTMLSelectElement>('spawn-triangle-kind'),
    spawnBaseRatio: required<HTMLInputElement>('spawn-base-ratio'),
    spawnSize: required<HTMLInputElement>('spawn-size'),
    spawnCount: required<HTMLInputElement>('spawn-count'),
    spawnMovementType: required<HTMLSelectElement>('spawn-movement-type'),
    spawnBoundary: required<HTMLSelectElement>('spawn-boundary'),
    spawnSpeed: required<HTMLInputElement>('spawn-speed'),
    spawnTurnRate: required<HTMLInputElement>('spawn-turn-rate'),
    spawnDecisionTicks: required<HTMLInputElement>('spawn-decision-ticks'),
    spawnIntentionMinTicks: required<HTMLInputElement>('spawn-intention-min-ticks'),
    spawnVx: required<HTMLInputElement>('spawn-vx'),
    spawnVy: required<HTMLInputElement>('spawn-vy'),
    spawnTargetX: required<HTMLInputElement>('spawn-target-x'),
    spawnTargetY: required<HTMLInputElement>('spawn-target-y'),
    spawnFeelingEnabled: required<HTMLInputElement>('spawn-feeling-enabled'),
    spawnFeelCooldown: required<HTMLInputElement>('spawn-feel-cooldown'),
    spawnApproachSpeed: required<HTMLInputElement>('spawn-approach-speed'),
    spawnFemaleRank: required<HTMLSelectElement>('spawn-female-rank'),
    spawnMimicryEnabled: required<HTMLInputElement>('spawn-mimicry-enabled'),
    spawnMimicrySignature: required<HTMLSelectElement>('spawn-mimicry-signature'),
    spawnFemaleRankRow: required<HTMLElement>('spawn-female-rank-row'),
    spawnMimicryRow: required<HTMLElement>('spawn-mimicry-row'),
    spawnMimicrySignatureRow: required<HTMLElement>('spawn-mimicry-signature-row'),
    spawnSidesRow: required<HTMLElement>('spawn-sides-row'),
    spawnIrregularRow: required<HTMLElement>('spawn-irregular-row'),
    spawnTriangleKindRow: required<HTMLElement>('spawn-triangle-kind-row'),
    spawnBaseRatioRow: required<HTMLElement>('spawn-base-ratio-row'),
    spawnSpeedRow: required<HTMLElement>('spawn-speed-row'),
    spawnTurnRateRow: required<HTMLElement>('spawn-turn-rate-row'),
    spawnSocialDecisionRow: required<HTMLElement>('spawn-social-decision-row'),
    spawnSocialIntentionRow: required<HTMLElement>('spawn-social-intention-row'),
    spawnDriftRow: required<HTMLElement>('spawn-drift-row'),
    spawnTargetRow: required<HTMLElement>('spawn-target-row'),
    selectedId: required<HTMLElement>('selected-id'),
    inspectorNone: required<HTMLElement>('inspector-none'),
    inspectorFields: required<HTMLElement>('inspector-fields'),
    inspectorRank: required<HTMLElement>('inspector-rank'),
    inspectorShape: required<HTMLElement>('inspector-shape'),
    inspectorKills: required<HTMLElement>('inspector-kills'),
    inspectorMovementType: required<HTMLSelectElement>('inspector-movement-type'),
    inspectorBoundary: required<HTMLSelectElement>('inspector-boundary'),
    inspectorVisionEnabled: required<HTMLInputElement>('inspector-vision-enabled'),
    inspectorVisionRange: required<HTMLInputElement>('inspector-vision-range'),
    inspectorAvoidDistance: required<HTMLInputElement>('inspector-avoid-distance'),
    inspectorHearingSkill: required<HTMLInputElement>('inspector-hearing-skill'),
    inspectorHearingRadius: required<HTMLInputElement>('inspector-hearing-radius'),
    inspectorHeardSignature: required<HTMLElement>('inspector-heard-signature'),
    inspectorPeaceCryRow: required<HTMLElement>('inspector-peace-cry-row'),
    inspectorPeaceCryEnabled: required<HTMLInputElement>('inspector-peace-cry-enabled'),
    inspectorPeaceCryCadence: required<HTMLInputElement>('inspector-peace-cry-cadence'),
    inspectorPeaceCryRadius: required<HTMLInputElement>('inspector-peace-cry-radius'),
    inspectorFeelingEnabled: required<HTMLInputElement>('inspector-feeling-enabled'),
    inspectorFeelCooldown: required<HTMLInputElement>('inspector-feel-cooldown'),
    inspectorApproachSpeed: required<HTMLInputElement>('inspector-approach-speed'),
    inspectorKnownCount: required<HTMLElement>('inspector-known-count'),
    inspectorLastFeltTick: required<HTMLElement>('inspector-last-felt-tick'),
    inspectorKnownList: required<HTMLElement>('inspector-known-list'),
    inspectorReproductionRow: required<HTMLElement>('inspector-reproduction-row'),
    inspectorFertilityEnabled: required<HTMLElement>('inspector-fertility-enabled'),
    inspectorFertilityMature: required<HTMLElement>('inspector-fertility-mature'),
    inspectorPregnant: required<HTMLElement>('inspector-pregnant'),
    inspectorPregnancyFather: required<HTMLElement>('inspector-pregnancy-father'),
    inspectorPregnancyTicks: required<HTMLElement>('inspector-pregnancy-ticks'),
    inspectorSpeed: required<HTMLInputElement>('inspector-speed'),
    inspectorTurnRate: required<HTMLInputElement>('inspector-turn-rate'),
    inspectorDecisionTicks: required<HTMLInputElement>('inspector-decision-ticks'),
    inspectorIntentionMinTicks: required<HTMLInputElement>('inspector-intention-min-ticks'),
    inspectorVx: required<HTMLInputElement>('inspector-vx'),
    inspectorVy: required<HTMLInputElement>('inspector-vy'),
    inspectorTargetX: required<HTMLInputElement>('inspector-target-x'),
    inspectorTargetY: required<HTMLInputElement>('inspector-target-y'),
    inspectorCurrentIntention: required<HTMLElement>('inspector-current-intention'),
    inspectorIntentionLeft: required<HTMLElement>('inspector-intention-left'),
    inspectorGeneration: required<HTMLElement>('inspector-generation'),
    inspectorDynastyId: required<HTMLElement>('inspector-dynasty-id'),
    inspectorMotherId: required<HTMLElement>('inspector-mother-id'),
    inspectorFatherId: required<HTMLElement>('inspector-father-id'),
    inspectorAncestors: required<HTMLElement>('inspector-ancestors'),
    inspectorLegacyBirths: required<HTMLElement>('inspector-legacy-births'),
    inspectorLegacyKills: required<HTMLElement>('inspector-legacy-kills'),
    inspectorLegacyHandshakes: required<HTMLElement>('inspector-legacy-handshakes'),
    inspectorLegacyRegularizations: required<HTMLElement>('inspector-legacy-regularizations'),
    inspectorLegacyDescendants: required<HTMLElement>('inspector-legacy-descendants'),
    inspectorAge: required<HTMLElement>('inspector-age'),
    inspectorDurability: required<HTMLElement>('inspector-durability'),
    inspectorTriangleInfoRow: required<HTMLElement>('inspector-triangle-row'),
    inspectorTriangleKind: required<HTMLElement>('inspector-triangle-kind'),
    inspectorBaseRatio: required<HTMLElement>('inspector-triangle-base-ratio'),
    inspectorIrregularRow: required<HTMLElement>('inspector-irregular-row'),
    inspectorIrregularState: required<HTMLElement>('inspector-irregular-state'),
    inspectorIrregularDeviation: required<HTMLElement>('inspector-irregular-deviation'),
    inspectorVoiceRow: required<HTMLElement>('inspector-voice-row'),
    inspectorVoiceEnabled: required<HTMLInputElement>('inspector-voice-enabled'),
    inspectorVoiceSignature: required<HTMLSelectElement>('inspector-voice-signature'),
    inspectorFemaleRankRow: required<HTMLElement>('inspector-female-rank-row'),
    inspectorFemaleRank: required<HTMLElement>('inspector-female-rank'),
    inspectorSwayRow: required<HTMLElement>('inspector-sway-row'),
    inspectorSwayAmplitude: required<HTMLElement>('inspector-sway-amplitude'),
    inspectorSwayFrequency: required<HTMLElement>('inspector-sway-frequency'),
    inspectorSpeedRow: required<HTMLElement>('inspector-speed-row'),
    inspectorTurnRateRow: required<HTMLElement>('inspector-turn-rate-row'),
    inspectorSocialRow: required<HTMLElement>('inspector-social-row'),
    inspectorLineageRow: required<HTMLElement>('inspector-lineage-row'),
    inspectorDriftRow: required<HTMLElement>('inspector-drift-row'),
    inspectorTargetRow: required<HTMLElement>('inspector-target-row'),
    tickValue: required<HTMLElement>('stat-tick'),
    seedValue: required<HTMLElement>('stat-seed'),
    deathsValue: required<HTMLElement>('stat-deaths'),
    regularizedValue: required<HTMLElement>('stat-regularized'),
    totalAliveValue: required<HTMLElement>('stat-total'),
    rankList: required<HTMLElement>('rank-list'),
  };
}

function required<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
}

export function movementToSpawnConfig(movement: MovementComponent): SpawnMovementConfig {
  if (movement.type === 'straightDrift') {
    return {
      type: 'straightDrift',
      boundary: movement.boundary,
      vx: movement.vx,
      vy: movement.vy,
    };
  }

  if (movement.type === 'randomWalk') {
    return {
      type: 'randomWalk',
      boundary: movement.boundary,
      speed: movement.speed,
      turnRate: movement.turnRate,
    };
  }

  if (movement.type === 'socialNav') {
    return {
      type: 'socialNav',
      boundary: movement.boundary,
      maxSpeed: movement.maxSpeed,
      maxTurnRate: movement.maxTurnRate,
      decisionEveryTicks: movement.decisionEveryTicks,
      intentionMinTicks: movement.intentionMinTicks,
    };
  }

  return {
    type: 'seekPoint',
    boundary: movement.boundary,
    speed: movement.speed,
    turnRate: movement.turnRate,
    target: movement.target,
  };
}

export function targetLabel(target: Vec2): string {
  return `(${target.x.toFixed(1)}, ${target.y.toFixed(1)})`;
}
