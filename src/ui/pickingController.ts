import { geometryFromComponents } from '../core/entityGeometry';
import type { World } from '../core/world';
import {
  distancePointToConvexPolygonEdges,
  distancePointToSegment,
  hitTestCircle,
  hitTestPolygon,
  hitTestSegment,
  pointInConvexPolygon,
} from '../geometry/picking';
import { EPSILON, distance } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { Camera } from '../render/camera';
import type { SelectionState } from './selectionState';

const DEFAULT_TOLERANCE_CSS_PX = 10;
const DEFAULT_DRAG_THRESHOLD_CSS_PX = 7;
const SEGMENT_TOLERANCE_MULTIPLIER = 1.25;

interface PointerInteraction {
  pointerId: number;
  startClient: Vec2;
  lastClient: Vec2;
  dragging: boolean;
}

interface CanvasRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CanvasMetrics {
  rect: CanvasRectLike;
  scaleX: number;
  scaleY: number;
}

export function getCanvasMetrics(canvas: HTMLCanvasElement): CanvasMetrics {
  const rect = canvas.getBoundingClientRect();
  const safeRectWidth = Math.max(rect.width, 1);
  const safeRectHeight = Math.max(rect.height, 1);
  const safeCanvasWidth = Math.max(canvas.width, 1);
  const safeCanvasHeight = Math.max(canvas.height, 1);

  return {
    rect,
    scaleX: safeCanvasWidth / safeRectWidth,
    scaleY: safeCanvasHeight / safeRectHeight,
  };
}

export function clientToCanvasPixels(
  metrics: CanvasMetrics,
  clientX: number,
  clientY: number,
): Vec2 {
  return {
    x: (clientX - metrics.rect.left) * metrics.scaleX,
    y: (clientY - metrics.rect.top) * metrics.scaleY,
  };
}

export function cssToleranceToWorldTolerance(
  toleranceCssPx: number,
  scaleX: number,
  scaleY: number,
  zoom: number,
): number {
  const safeZoom = Math.max(zoom, EPSILON);
  const toleranceCanvasPx = toleranceCssPx * ((scaleX + scaleY) / 2);
  return toleranceCanvasPx / safeZoom;
}

export function cssDistance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function shouldTreatPointerAsClick(
  movedCssPx: number,
  dragThresholdCssPx: number,
): boolean {
  return movedCssPx <= dragThresholdCssPx;
}

function isInsideDrawableContent(metrics: CanvasMetrics, clientX: number, clientY: number): boolean {
  const right = metrics.rect.left + metrics.rect.width;
  const bottom = metrics.rect.top + metrics.rect.height;
  return clientX >= metrics.rect.left && clientX <= right && clientY >= metrics.rect.top && clientY <= bottom;
}

function centroidOfGeometry(geometry: ReturnType<typeof geometryFromComponents>): Vec2 {
  if (geometry.kind === 'circle') {
    return geometry.center;
  }

  if (geometry.kind === 'segment') {
    return {
      x: (geometry.a.x + geometry.b.x) / 2,
      y: (geometry.a.y + geometry.b.y) / 2,
    };
  }

  let sx = 0;
  let sy = 0;
  for (const vertex of geometry.vertices) {
    sx += vertex.x;
    sy += vertex.y;
  }

  return {
    x: sx / geometry.vertices.length,
    y: sy / geometry.vertices.length,
  };
}

function scoreGeometryDistance(point: Vec2, geometry: ReturnType<typeof geometryFromComponents>): number {
  if (geometry.kind === 'circle') {
    return Math.max(0, distance(point, geometry.center) - geometry.radius);
  }

  if (geometry.kind === 'segment') {
    return distancePointToSegment(point, geometry.a, geometry.b);
  }

  if (pointInConvexPolygon(point, geometry.vertices)) {
    return 0;
  }

  return distancePointToConvexPolygonEdges(point, geometry.vertices);
}

function geometryHit(
  point: Vec2,
  toleranceWorld: number,
  geometry: ReturnType<typeof geometryFromComponents>,
): boolean {
  if (geometry.kind === 'circle') {
    return hitTestCircle(point, geometry.center, geometry.radius, toleranceWorld);
  }

  if (geometry.kind === 'segment') {
    return hitTestSegment(point, geometry.a, geometry.b, toleranceWorld * SEGMENT_TOLERANCE_MULTIPLIER);
  }

  return hitTestPolygon(point, geometry.vertices, toleranceWorld);
}

export function pickEntityAtWorldPoint(
  world: World,
  pointWorld: Vec2,
  toleranceWorld: number,
): number | null {
  const ids = [...world.entities].sort((a, b) => a - b);
  let bestId: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestCentroidDistance = Number.POSITIVE_INFINITY;

  for (const id of ids) {
    if (world.staticObstacles.has(id)) {
      continue;
    }

    const shape = world.shapes.get(id);
    const transform = world.transforms.get(id);
    if (!shape || !transform) {
      continue;
    }

    const geometry = world.geometries.get(id) ?? geometryFromComponents(shape, transform);
    if (!geometryHit(pointWorld, toleranceWorld, geometry)) {
      continue;
    }

    const score = scoreGeometryDistance(pointWorld, geometry);
    const centroidDistance = distance(pointWorld, centroidOfGeometry(geometry));
    const scoreImproved = score < bestScore - EPSILON;
    const sameScore = Math.abs(score - bestScore) <= EPSILON;
    const centroidImproved = centroidDistance < bestCentroidDistance - EPSILON;

    if (
      scoreImproved ||
      (sameScore && centroidImproved) ||
      (sameScore && Math.abs(centroidDistance - bestCentroidDistance) <= EPSILON && (bestId === null || id < bestId))
    ) {
      bestId = id;
      bestScore = score;
      bestCentroidDistance = centroidDistance;
    }
  }

  return bestId;
}

export interface PickingControllerOptions {
  canvas: HTMLCanvasElement;
  camera: Camera;
  selectionState: SelectionState;
  getWorld: () => World;
  onClickWorldPoint?: (point: Vec2) => void;
  onSelectionApplied?: (selectedId: number | null) => void;
  tolerancePx?: number;
  dragThresholdPx?: number;
}

export class PickingController {
  private readonly toleranceCssPx: number;
  private readonly dragThresholdCssPx: number;
  private pointer: PointerInteraction | null = null;

  constructor(private readonly options: PickingControllerOptions) {
    this.toleranceCssPx = options.tolerancePx ?? DEFAULT_TOLERANCE_CSS_PX;
    this.dragThresholdCssPx = options.dragThresholdPx ?? DEFAULT_DRAG_THRESHOLD_CSS_PX;
  }

  attach(): void {
    const { canvas } = this.options;
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('dblclick', this.onDoubleClick);
  }

  detach(): void {
    const { canvas } = this.options;
    canvas.removeEventListener('pointerdown', this.onPointerDown);
    canvas.removeEventListener('pointermove', this.onPointerMove);
    canvas.removeEventListener('pointerup', this.onPointerUp);
    canvas.removeEventListener('pointercancel', this.onPointerCancel);
    canvas.removeEventListener('wheel', this.onWheel);
    canvas.removeEventListener('dblclick', this.onDoubleClick);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }

    const metrics = getCanvasMetrics(this.options.canvas);
    if (!isInsideDrawableContent(metrics, event.clientX, event.clientY)) {
      return;
    }

    const startClient = { x: event.clientX, y: event.clientY };

    this.pointer = {
      pointerId: event.pointerId,
      startClient,
      lastClient: startClient,
      dragging: false,
    };
    this.options.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.pointer || event.pointerId !== this.pointer.pointerId) {
      return;
    }

    const metrics = getCanvasMetrics(this.options.canvas);
    const currentClient = { x: event.clientX, y: event.clientY };

    const dxCss = currentClient.x - this.pointer.lastClient.x;
    const dyCss = currentClient.y - this.pointer.lastClient.y;

    if (!this.pointer.dragging) {
      const movedCss = cssDistance(currentClient, this.pointer.startClient);
      if (movedCss > this.dragThresholdCssPx) {
        this.pointer.dragging = true;
      }
    }

    if (this.pointer.dragging) {
      this.options.camera.panByPixels(dxCss * metrics.scaleX, dyCss * metrics.scaleY);
    }

    this.pointer.lastClient = currentClient;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (!this.pointer || event.pointerId !== this.pointer.pointerId) {
      return;
    }

    const metrics = getCanvasMetrics(this.options.canvas);
    const endClient = { x: event.clientX, y: event.clientY };
    const endCanvas = clientToCanvasPixels(metrics, event.clientX, event.clientY);
    const movedCss = cssDistance(endClient, this.pointer.startClient);
    const shouldPick = shouldTreatPointerAsClick(movedCss, this.dragThresholdCssPx);
    this.pointer = null;

    if (this.options.canvas.hasPointerCapture(event.pointerId)) {
      this.options.canvas.releasePointerCapture(event.pointerId);
    }

    if (!shouldPick) {
      return;
    }

    if (!isInsideDrawableContent(metrics, event.clientX, event.clientY)) {
      return;
    }

    const pointWorld = this.options.camera.screenToWorld(endCanvas.x, endCanvas.y, this.options.canvas);
    const toleranceWorld = cssToleranceToWorldTolerance(
      this.toleranceCssPx,
      metrics.scaleX,
      metrics.scaleY,
      this.options.camera.zoom,
    );
    const selectedId = pickEntityAtWorldPoint(this.options.getWorld(), pointWorld, toleranceWorld);
    this.options.selectionState.setSelected(selectedId, { forceNotify: true });
    this.options.onClickWorldPoint?.(pointWorld);
    this.options.onSelectionApplied?.(selectedId);
  };

  private readonly onPointerCancel = (event: PointerEvent): void => {
    if (this.pointer && event.pointerId === this.pointer.pointerId) {
      this.pointer = null;
      if (this.options.canvas.hasPointerCapture(event.pointerId)) {
        this.options.canvas.releasePointerCapture(event.pointerId);
      }
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const metrics = getCanvasMetrics(this.options.canvas);
    const pointCanvas = clientToCanvasPixels(metrics, event.clientX, event.clientY);
    const zoomFactor = Math.exp(-event.deltaY * 0.0015);
    this.options.camera.zoomAt(pointCanvas.x, pointCanvas.y, zoomFactor, this.options.canvas);
  };

  private readonly onDoubleClick = (): void => {
    const world = this.options.getWorld();
    this.options.camera.reset(world.config.width, world.config.height);
  };
}
