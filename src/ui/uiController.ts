import type { MovementComponent, VisionComponent } from '../core/components';
import {
  DEFAULT_ISOSCELES_BASE_RATIO,
  MAX_ISOSCELES_BASE_RATIO,
  MIN_ISOSCELES_BASE_RATIO,
  type SpawnMovementConfig,
  type SpawnRequest,
} from '../core/factory';
import { Rank } from '../core/rank';
import type { RankComponent } from '../core/rank';
import type { ShapeComponent, TriangleKind } from '../core/shapes';
import { boundaryFromTopology, type WorldTopology } from '../core/topology';
import type { World } from '../core/world';
import type { Vec2 } from '../geometry/vector';

export interface SouthAttractionSettings {
  enabled: boolean;
  strength: number;
  womenMultiplier: number;
  zoneStartFrac: number;
  zoneEndFrac: number;
  drag: number;
  maxTerminal: number;
  showSouthZoneOverlay: boolean;
  showClickDebug: boolean;
}

interface UiCallbacks {
  onToggleRun: () => boolean;
  onStep: () => void;
  onReset: (seed: number) => void;
  onSpawn: (request: SpawnRequest) => void;
  onTopologyUpdate: (topology: WorldTopology) => void;
  onSouthAttractionUpdate: (settings: SouthAttractionSettings) => void;
  onInspectorUpdate: (movement: SpawnMovementConfig) => void;
  onInspectorVisionUpdate: (vision: Partial<VisionComponent>) => void;
}

interface InputRefs {
  runButton: HTMLButtonElement;
  stepButton: HTMLButtonElement;
  resetButton: HTMLButtonElement;
  seedInput: HTMLInputElement;
  worldTopology: HTMLSelectElement;
  southEnabled: HTMLInputElement;
  southStrength: HTMLInputElement;
  southWomenMultiplier: HTMLInputElement;
  southZoneStart: HTMLInputElement;
  southZoneEnd: HTMLInputElement;
  southDrag: HTMLInputElement;
  southMaxTerminal: HTMLInputElement;
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
  spawnVx: HTMLInputElement;
  spawnVy: HTMLInputElement;
  spawnTargetX: HTMLInputElement;
  spawnTargetY: HTMLInputElement;
  spawnSidesRow: HTMLElement;
  spawnIrregularRow: HTMLElement;
  spawnTriangleKindRow: HTMLElement;
  spawnBaseRatioRow: HTMLElement;
  spawnSpeedRow: HTMLElement;
  spawnTurnRateRow: HTMLElement;
  spawnDriftRow: HTMLElement;
  spawnTargetRow: HTMLElement;
  selectedId: HTMLElement;
  inspectorNone: HTMLElement;
  inspectorFields: HTMLElement;
  inspectorRank: HTMLElement;
  inspectorShape: HTMLElement;
  inspectorMovementType: HTMLSelectElement;
  inspectorBoundary: HTMLSelectElement;
  inspectorVisionEnabled: HTMLInputElement;
  inspectorVisionRange: HTMLInputElement;
  inspectorAvoidDistance: HTMLInputElement;
  inspectorSpeed: HTMLInputElement;
  inspectorTurnRate: HTMLInputElement;
  inspectorVx: HTMLInputElement;
  inspectorVy: HTMLInputElement;
  inspectorTargetX: HTMLInputElement;
  inspectorTargetY: HTMLInputElement;
  inspectorTriangleInfoRow: HTMLElement;
  inspectorTriangleKind: HTMLElement;
  inspectorBaseRatio: HTMLElement;
  inspectorSpeedRow: HTMLElement;
  inspectorTurnRateRow: HTMLElement;
  inspectorDriftRow: HTMLElement;
  inspectorTargetRow: HTMLElement;
  tickValue: HTMLElement;
  seedValue: HTMLElement;
  deathsValue: HTMLElement;
  totalAliveValue: HTMLElement;
  rankList: HTMLElement;
}

export class UIController {
  private readonly refs: InputRefs;
  private selectedEntityId: number | null = null;

  constructor(private readonly callbacks: UiCallbacks) {
    this.refs = collectRefs();
    this.syncBoundaryControlsToTopology(this.readTopology());
    this.wireControls();
    this.updateSpawnFieldVisibility();
    this.updateInspectorFieldVisibility();
    this.callbacks.onSouthAttractionUpdate(this.readSouthAttractionSettings());
    this.renderSelected(null, null, null, null, null);
  }

  renderStats(world: World): void {
    this.refs.tickValue.textContent = String(world.tick);
    this.refs.seedValue.textContent = String(world.seed);
    this.refs.deathsValue.textContent = String(world.deathsThisTick);
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
  ): void {
    this.selectedEntityId = entityId;
    if (entityId === null || movement === null || shape === null || rank === null || vision === null) {
      this.refs.selectedId.textContent = 'None';
      this.refs.inspectorRank.textContent = 'N/A';
      this.refs.inspectorShape.textContent = 'N/A';
      this.refs.inspectorNone.hidden = false;
      this.refs.inspectorFields.hidden = true;
      this.refs.inspectorTriangleInfoRow.hidden = true;
      return;
    }

    this.refs.selectedId.textContent = String(entityId);
    this.refs.inspectorRank.textContent = rankLabel(rank, shape);
    this.refs.inspectorShape.textContent = shapeLabel(shape);
    this.refs.inspectorNone.hidden = true;
    this.refs.inspectorFields.hidden = false;

    this.refs.inspectorMovementType.value = movement.type;
    this.refs.inspectorBoundary.value = movement.boundary;
    this.refs.inspectorVisionEnabled.checked = vision.enabled;
    this.refs.inspectorVisionRange.value = vision.range.toFixed(1);
    this.refs.inspectorAvoidDistance.value = vision.avoidDistance.toFixed(1);

    if (movement.type === 'straightDrift') {
      this.refs.inspectorVx.value = movement.vx.toFixed(2);
      this.refs.inspectorVy.value = movement.vy.toFixed(2);
      this.refs.inspectorSpeed.value = '30';
      this.refs.inspectorTurnRate.value = '2';
      this.refs.inspectorTargetX.value = '500';
      this.refs.inspectorTargetY.value = '350';
    } else if (movement.type === 'randomWalk') {
      this.refs.inspectorSpeed.value = movement.speed.toFixed(2);
      this.refs.inspectorTurnRate.value = movement.turnRate.toFixed(2);
      this.refs.inspectorVx.value = '0';
      this.refs.inspectorVy.value = '0';
      this.refs.inspectorTargetX.value = '500';
      this.refs.inspectorTargetY.value = '350';
    } else {
      this.refs.inspectorSpeed.value = movement.speed.toFixed(2);
      this.refs.inspectorTurnRate.value = movement.turnRate.toFixed(2);
      this.refs.inspectorVx.value = '0';
      this.refs.inspectorVy.value = '0';
      this.refs.inspectorTargetX.value = movement.target.x.toFixed(2);
      this.refs.inspectorTargetY.value = movement.target.y.toFixed(2);
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

    this.updateInspectorFieldVisibility();
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

    this.refs.inspectorMovementType.addEventListener('change', () => {
      this.updateInspectorFieldVisibility();
      this.emitInspectorUpdate();
    });

    const inspectorInputs: Array<HTMLInputElement | HTMLSelectElement> = [
      this.refs.inspectorSpeed,
      this.refs.inspectorTurnRate,
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
      drag: clampPositive(parseNumber(this.refs.southDrag.value, 10)),
      maxTerminal: clampPositive(parseNumber(this.refs.southMaxTerminal.value, 2)),
      showSouthZoneOverlay: this.refs.southShowZone.checked,
      showClickDebug: this.refs.southShowClickDebug.checked,
    };
  }

  private readSpawnRequest(): SpawnRequest {
    const shapeType = this.refs.spawnShape.value;

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

    const movement = this.readSpawnMovement(
      this.refs.spawnMovementType.value,
      boundaryFromTopology(this.readTopology()),
      this.refs.spawnSpeed,
      this.refs.spawnTurnRate,
      this.refs.spawnVx,
      this.refs.spawnVy,
      this.refs.spawnTargetX,
      this.refs.spawnTargetY,
    );

    return {
      shape,
      movement,
      count: Math.max(1, parseInteger(this.refs.spawnCount.value, 1)),
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

  private updateSpawnFieldVisibility(): void {
    const shapeType = this.refs.spawnShape.value;
    const movementType = this.refs.spawnMovementType.value;
    const sides = parseInteger(this.refs.spawnSides.value, 6);
    const isTrianglePolygon = shapeType === 'polygon' && sides === 3;

    this.refs.spawnSidesRow.hidden = shapeType !== 'polygon';
    this.refs.spawnIrregularRow.hidden = shapeType !== 'polygon' || isTrianglePolygon;
    this.refs.spawnTriangleKindRow.hidden = !isTrianglePolygon;

    const triangleKind = parseTriangleKind(this.refs.spawnTriangleKind.value);
    this.refs.spawnBaseRatioRow.hidden = !isTrianglePolygon || triangleKind !== 'Isosceles';

    this.refs.spawnSpeedRow.hidden = movementType === 'straightDrift';
    this.refs.spawnTurnRateRow.hidden = movementType === 'straightDrift';
    this.refs.spawnDriftRow.hidden = movementType !== 'straightDrift';
    this.refs.spawnTargetRow.hidden = movementType !== 'seekPoint';
  }

  private updateInspectorFieldVisibility(): void {
    const movementType = this.refs.inspectorMovementType.value;

    this.refs.inspectorSpeedRow.hidden = movementType === 'straightDrift';
    this.refs.inspectorTurnRateRow.hidden = movementType === 'straightDrift';
    this.refs.inspectorDriftRow.hidden = movementType !== 'straightDrift';
    this.refs.inspectorTargetRow.hidden = movementType !== 'seekPoint';
  }

  private readSpawnMovement(
    movementType: string,
    boundary: SpawnMovementConfig['boundary'],
    speedInput: HTMLInputElement,
    turnRateInput: HTMLInputElement,
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
    seedInput: required<HTMLInputElement>('seed-input'),
    worldTopology: required<HTMLSelectElement>('world-topology'),
    southEnabled: required<HTMLInputElement>('south-enabled'),
    southStrength: required<HTMLInputElement>('south-strength'),
    southWomenMultiplier: required<HTMLInputElement>('south-women-multiplier'),
    southZoneStart: required<HTMLInputElement>('south-zone-start'),
    southZoneEnd: required<HTMLInputElement>('south-zone-end'),
    southDrag: required<HTMLInputElement>('south-drag'),
    southMaxTerminal: required<HTMLInputElement>('south-max-terminal'),
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
    spawnVx: required<HTMLInputElement>('spawn-vx'),
    spawnVy: required<HTMLInputElement>('spawn-vy'),
    spawnTargetX: required<HTMLInputElement>('spawn-target-x'),
    spawnTargetY: required<HTMLInputElement>('spawn-target-y'),
    spawnSidesRow: required<HTMLElement>('spawn-sides-row'),
    spawnIrregularRow: required<HTMLElement>('spawn-irregular-row'),
    spawnTriangleKindRow: required<HTMLElement>('spawn-triangle-kind-row'),
    spawnBaseRatioRow: required<HTMLElement>('spawn-base-ratio-row'),
    spawnSpeedRow: required<HTMLElement>('spawn-speed-row'),
    spawnTurnRateRow: required<HTMLElement>('spawn-turn-rate-row'),
    spawnDriftRow: required<HTMLElement>('spawn-drift-row'),
    spawnTargetRow: required<HTMLElement>('spawn-target-row'),
    selectedId: required<HTMLElement>('selected-id'),
    inspectorNone: required<HTMLElement>('inspector-none'),
    inspectorFields: required<HTMLElement>('inspector-fields'),
    inspectorRank: required<HTMLElement>('inspector-rank'),
    inspectorShape: required<HTMLElement>('inspector-shape'),
    inspectorMovementType: required<HTMLSelectElement>('inspector-movement-type'),
    inspectorBoundary: required<HTMLSelectElement>('inspector-boundary'),
    inspectorVisionEnabled: required<HTMLInputElement>('inspector-vision-enabled'),
    inspectorVisionRange: required<HTMLInputElement>('inspector-vision-range'),
    inspectorAvoidDistance: required<HTMLInputElement>('inspector-avoid-distance'),
    inspectorSpeed: required<HTMLInputElement>('inspector-speed'),
    inspectorTurnRate: required<HTMLInputElement>('inspector-turn-rate'),
    inspectorVx: required<HTMLInputElement>('inspector-vx'),
    inspectorVy: required<HTMLInputElement>('inspector-vy'),
    inspectorTargetX: required<HTMLInputElement>('inspector-target-x'),
    inspectorTargetY: required<HTMLInputElement>('inspector-target-y'),
    inspectorTriangleInfoRow: required<HTMLElement>('inspector-triangle-row'),
    inspectorTriangleKind: required<HTMLElement>('inspector-triangle-kind'),
    inspectorBaseRatio: required<HTMLElement>('inspector-triangle-base-ratio'),
    inspectorSpeedRow: required<HTMLElement>('inspector-speed-row'),
    inspectorTurnRateRow: required<HTMLElement>('inspector-turn-rate-row'),
    inspectorDriftRow: required<HTMLElement>('inspector-drift-row'),
    inspectorTargetRow: required<HTMLElement>('inspector-target-row'),
    tickValue: required<HTMLElement>('stat-tick'),
    seedValue: required<HTMLElement>('stat-seed'),
    deathsValue: required<HTMLElement>('stat-deaths'),
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
