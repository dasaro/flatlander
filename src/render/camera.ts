import { clamp, vec } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';

export class Camera {
  center: Vec2;
  zoom: number;

  constructor(
    worldWidth: number,
    worldHeight: number,
    private readonly minZoom = 0.25,
    private readonly maxZoom = 6,
  ) {
    this.center = vec(worldWidth / 2, worldHeight / 2);
    this.zoom = 1;
  }

  reset(worldWidth: number, worldHeight: number): void {
    this.center = vec(worldWidth / 2, worldHeight / 2);
    this.zoom = 1;
  }

  setZoom(nextZoom: number): void {
    this.zoom = clamp(nextZoom, this.minZoom, this.maxZoom);
  }

  panByPixels(deltaXPx: number, deltaYPx: number): void {
    this.center = {
      x: this.center.x - deltaXPx / this.zoom,
      y: this.center.y - deltaYPx / this.zoom,
    };
  }

  worldToScreen(
    x: number,
    y: number,
    canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
    dpr = 1,
  ): Vec2 {
    void dpr;
    return {
      x: (x - this.center.x) * this.zoom + canvas.width / 2,
      y: (y - this.center.y) * this.zoom + canvas.height / 2,
    };
  }

  screenToWorld(
    xPx: number,
    yPx: number,
    canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
    dpr = 1,
  ): Vec2 {
    void dpr;
    return {
      x: (xPx - canvas.width / 2) / this.zoom + this.center.x,
      y: (yPx - canvas.height / 2) / this.zoom + this.center.y,
    };
  }

  applyToContext(
    ctx: CanvasRenderingContext2D,
    canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
    dpr = 1,
  ): void {
    void dpr;
    const tx = canvas.width / 2 - this.center.x * this.zoom;
    const ty = canvas.height / 2 - this.center.y * this.zoom;
    ctx.setTransform(this.zoom, 0, 0, this.zoom, tx, ty);
  }

  zoomAt(
    screenX: number,
    screenY: number,
    zoomFactor: number,
    canvas: Pick<HTMLCanvasElement, 'width' | 'height'>,
    dpr = 1,
  ): void {
    const before = this.screenToWorld(screenX, screenY, canvas, dpr);
    this.setZoom(this.zoom * zoomFactor);
    const after = this.screenToWorld(screenX, screenY, canvas, dpr);

    this.center = {
      x: this.center.x + (before.x - after.x),
      y: this.center.y + (before.y - after.y),
    };
  }
}
