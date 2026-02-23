import { geometryFromComponents } from '../core/entityGeometry';
import { getEyeWorldPosition } from '../core/eye';
import { Rank } from '../core/rank';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { Vec2 } from '../geometry/vector';
import type { Camera } from './camera';
import type { EffectsManager } from './effects';

export interface RenderOptions {
  showSouthZoneOverlay?: boolean;
  debugClickPoint?: Vec2 | null;
  effectsManager?: EffectsManager;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement, width: number, height: number) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable.');
    }

    this.ctx = context;
    this.setWorldSize(width, height);
  }

  setWorldSize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  render(
    world: World,
    camera: Camera,
    selectedEntityId: number | null,
    options: RenderOptions = {},
  ): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#f3f1e8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    camera.applyToContext(this.ctx, this.canvas);

    if (options.showSouthZoneOverlay) {
      this.drawSouthZoneOverlay(world);
    }

    this.ctx.strokeStyle = '#8d8778';
    this.ctx.lineWidth = 2 / camera.zoom;
    this.ctx.strokeRect(0, 0, world.config.width, world.config.height);

    const ids = getSortedEntityIds(world);
    for (const id of ids) {
      const shape = world.shapes.get(id);
      const transform = world.transforms.get(id);
      if (!shape || !transform) {
        continue;
      }

      const geometry = world.geometries.get(id) ?? geometryFromComponents(shape, transform);
      const house = world.houses.get(id);
      if (house && geometry.kind === 'polygon') {
        this.drawHouse(geometry.vertices, house.doorEastWorld, house.doorWestWorld, camera);
        continue;
      }

      const rank = world.ranks.get(id);
      if (!rank) {
        continue;
      }

      const isSelected = selectedEntityId === id;
      const fillColor = colorForRank(rank.rank);
      const triangleStroke =
        shape.kind === 'polygon' && shape.sides === 3 && !isSelected ? fillColor : '#232323';

      this.ctx.save();
      this.ctx.fillStyle = fillColor;
      this.ctx.strokeStyle = isSelected ? '#111111' : triangleStroke;
      this.ctx.lineWidth = (isSelected ? 3 : 1.5) / camera.zoom;

      if (geometry.kind === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (geometry.kind === 'segment') {
        this.ctx.beginPath();
        this.ctx.moveTo(geometry.a.x, geometry.a.y);
        this.ctx.lineTo(geometry.b.x, geometry.b.y);
        this.ctx.stroke();
      } else {
        const first = geometry.vertices[0];
        if (!first) {
          this.ctx.restore();
          continue;
        }
        this.ctx.beginPath();
        this.ctx.moveTo(first.x, first.y);
        for (let i = 1; i < geometry.vertices.length; i += 1) {
          const vertex = geometry.vertices[i];
          if (!vertex) {
            continue;
          }
          this.ctx.lineTo(vertex.x, vertex.y);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();

        if (shape.kind === 'polygon' && shape.sides === 3 && shape.triangleKind === 'Isosceles') {
          const centroid = polygonCentroid(geometry.vertices);
          this.ctx.fillStyle = fillColor;
          this.ctx.beginPath();
          this.ctx.arc(centroid.x, centroid.y, 2.5 / camera.zoom, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }

      this.ctx.restore();

      const eye = getEyeWorldPosition(world, id);
      if (eye) {
        this.ctx.save();
        this.ctx.fillStyle = isSelected ? '#111111' : '#f7f3ea';
        this.ctx.strokeStyle = '#111111';
        this.ctx.lineWidth = 1 / camera.zoom;
        this.ctx.beginPath();
        this.ctx.arc(eye.x, eye.y, (isSelected ? 3.5 : 2.5) / camera.zoom, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    options.effectsManager?.render(this.ctx, camera);

    this.ctx.restore();

    this.ctx.strokeStyle = '#8d8778';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);
    this.drawSouthIndicator();
    if (options.debugClickPoint) {
      this.drawDebugClick(options.debugClickPoint, camera);
    }
  }

  private drawSouthIndicator(): void {
    const x = this.canvas.width - 92;
    const y = 18;

    this.ctx.save();
    this.ctx.font = '12px Trebuchet MS, sans-serif';
    this.ctx.fillStyle = '#2e2b25';
    this.ctx.fillText('SOUTH', x, y);

    this.ctx.strokeStyle = '#2e2b25';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 26, y + 4);
    this.ctx.lineTo(x + 26, y + 20);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(x + 20, y + 15);
    this.ctx.lineTo(x + 26, y + 22);
    this.ctx.lineTo(x + 32, y + 15);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawSouthZoneOverlay(world: World): void {
    const startY = world.config.height * world.config.southAttractionZoneStartFrac;
    const endY = world.config.height * world.config.southAttractionZoneEndFrac;

    this.ctx.save();
    const gradient = this.ctx.createLinearGradient(0, startY, 0, world.config.height);
    gradient.addColorStop(0, 'rgba(206, 136, 55, 0)');
    gradient.addColorStop(
      Math.min(1, Math.max(0, endY / Math.max(1, world.config.height))),
      'rgba(206, 136, 55, 0.12)',
    );
    gradient.addColorStop(1, 'rgba(206, 136, 55, 0.22)');

    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, startY, world.config.width, world.config.height - startY);
    this.ctx.restore();
  }

  private drawHouse(vertices: Vec2[], eastDoor: Vec2, westDoor: Vec2, camera: Camera): void {
    const first = vertices[0];
    if (!first) {
      return;
    }

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(95, 89, 79, 0.18)';
    this.ctx.strokeStyle = 'rgba(86, 80, 71, 0.7)';
    this.ctx.lineWidth = 1.2 / camera.zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(first.x, first.y);
    for (let i = 1; i < vertices.length; i += 1) {
      const vertex = vertices[i];
      if (!vertex) {
        continue;
      }
      this.ctx.lineTo(vertex.x, vertex.y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.drawDoorMarker(eastDoor, '#c67a32', camera);
    this.drawDoorMarker(westDoor, '#396887', camera);
    this.ctx.restore();
  }

  private drawDoorMarker(position: Vec2, color: string, camera: Camera): void {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.strokeStyle = '#1f1d1a';
    this.ctx.lineWidth = 0.8 / camera.zoom;
    this.ctx.beginPath();
    this.ctx.arc(position.x, position.y, 2.4 / camera.zoom, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawDebugClick(pointWorld: Vec2, camera: Camera): void {
    const pointScreen = camera.worldToScreen(pointWorld.x, pointWorld.y, this.canvas);

    this.ctx.save();
    this.ctx.fillStyle = '#111111';
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(pointScreen.x, pointScreen.y, 4, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
    this.ctx.restore();
  }
}

function polygonCentroid(vertices: Vec2[]): Vec2 {
  let sx = 0;
  let sy = 0;
  for (const vertex of vertices) {
    sx += vertex.x;
    sy += vertex.y;
  }

  return {
    x: sx / vertices.length,
    y: sy / vertices.length,
  };
}

function colorForRank(rank: Rank): string {
  switch (rank) {
    case Rank.Woman:
      return '#d94f3d';
    case Rank.Priest:
      return '#f4c542';
    case Rank.Irregular:
      return '#8a1c1c';
    case Rank.Triangle:
      return '#5984b3';
    case Rank.Gentleman:
      return '#3aa17e';
    case Rank.Noble:
      return '#7f66b3';
    case Rank.NearCircle:
      return '#2f4f7f';
    default:
      return '#777777';
  }
}
