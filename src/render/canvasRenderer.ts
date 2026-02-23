import { geometryFromComponents } from '../core/entityGeometry';
import { getEyeWorldPosition } from '../core/eye';
import { Rank } from '../core/rank';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { Vec2 } from '../geometry/vector';
import type { Camera } from './camera';
import { selectTopKnownIds } from './contactNetwork';
import type { EffectsManager } from './effects';
import { fogIntensityAtDistance, fogRingRadiusForLevel, visualAlpha } from './viewModifiers';
import { APP_VERSION } from '../version';

export interface RenderOptions {
  showSouthZoneOverlay?: boolean;
  debugClickPoint?: Vec2 | null;
  effectsManager?: EffectsManager;
  strokeByKills?: boolean;
  showHearingOverlay?: boolean;
  showTalkingOverlay?: boolean;
  showContactNetwork?: boolean;
  networkShowParents?: boolean;
  networkShowKnown?: boolean;
  networkMaxKnownEdges?: number;
  networkShowOnlyOnScreen?: boolean;
  networkFocusRadius?: number;
  dimByAge?: boolean;
  dimByDeterioration?: boolean;
  dimStrength?: number;
  fogPreviewEnabled?: boolean;
  fogPreviewStrength?: number;
  fogPreviewHideBelowMin?: boolean;
  fogPreviewRings?: boolean;
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

    const selectedObserverEye =
      selectedEntityId !== null ? getEyeWorldPosition(world, selectedEntityId) : null;
    if (selectedObserverEye && options.fogPreviewEnabled && options.fogPreviewRings) {
      this.drawFogPreviewRings(world, selectedObserverEye, camera);
    }

    const ids = getSortedEntityIds(world);
    const ageHalfLifeTicks = 6_000;
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
      const kills = world.combatStats.get(id)?.kills ?? 0;
      const killStrokeColor = colorForKillCount(kills);
      const defaultStroke =
        shape.kind === 'polygon' && shape.sides === 3 && !isSelected ? fillColor : '#232323';
      let entityAlpha = visualAlpha({
        ticksAlive: world.ages.get(id)?.ticksAlive ?? 0,
        hp: world.durability.get(id)?.hp ?? null,
        maxHp: world.durability.get(id)?.maxHp ?? null,
        dimByAge: options.dimByAge ?? false,
        dimByDeterioration: options.dimByDeterioration ?? false,
        strength: options.dimStrength ?? 0.25,
        ageHalfLifeTicks,
      });

      if (selectedObserverEye && options.fogPreviewEnabled && id !== selectedEntityId) {
        const center = geometryCenter(geometry);
        const distance = Math.hypot(
          center.x - selectedObserverEye.x,
          center.y - selectedObserverEye.y,
        );
        const intensity = fogIntensityAtDistance(
          distance,
          world.config.fogDensity,
          world.config.fogMaxDistance,
        );
        if ((options.fogPreviewHideBelowMin ?? false) && intensity < world.config.fogMinIntensity) {
          continue;
        }
        const previewStrength = Math.max(0, Math.min(1, options.fogPreviewStrength ?? 0.2));
        entityAlpha *= 1 + (intensity - 1) * previewStrength;
      }
      entityAlpha = Math.max(0.05, Math.min(1, entityAlpha));
      if (isSelected) {
        entityAlpha = Math.max(entityAlpha, 0.85);
      }

      this.ctx.save();
      this.ctx.globalAlpha = entityAlpha;
      this.ctx.fillStyle = fillColor;
      this.ctx.strokeStyle = isSelected
        ? '#111111'
        : options.strokeByKills
          ? killStrokeColor
          : defaultStroke;
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
        this.ctx.globalAlpha = Math.max(0.35, entityAlpha);
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

    if (options.showContactNetwork && selectedEntityId !== null) {
      this.drawContactNetworkOverlay(world, camera, selectedEntityId, options);
    }

    if (options.showHearingOverlay && selectedEntityId !== null) {
      this.drawSelectedHearingOverlay(world, selectedEntityId, camera, options.showTalkingOverlay ?? false);
    }

    options.effectsManager?.render(this.ctx, camera, selectedEntityId);

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
    const versionText = `v${APP_VERSION}`;
    const versionWidth = this.ctx.measureText(versionText).width;
    this.ctx.fillText(versionText, this.canvas.width - versionWidth - 10, 12);

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

  private drawSelectedHearingOverlay(
    world: World,
    selectedEntityId: number,
    camera: Camera,
    showTalkingOverlay: boolean,
  ): void {
    const hearingHit = world.hearingHits.get(selectedEntityId);
    if (!hearingHit) {
      return;
    }

    const listenerTransform = world.transforms.get(selectedEntityId);
    const speakerTransform = world.transforms.get(hearingHit.otherId);
    if (!listenerTransform || !speakerTransform) {
      return;
    }

    const listenerEye = getEyeWorldPosition(world, selectedEntityId) ?? listenerTransform.position;
    const speakerGeometry =
      world.geometries.get(hearingHit.otherId) ??
      (() => {
        const shape = world.shapes.get(hearingHit.otherId);
        if (!shape) {
          return null;
        }
        return geometryFromComponents(shape, speakerTransform);
      })();
    if (!speakerGeometry) {
      return;
    }

    const speakerCenter = geometryCenter(speakerGeometry);
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(58, 103, 140, 0.35)';
    this.ctx.lineWidth = 1.2 / camera.zoom;
    this.ctx.setLineDash([6 / camera.zoom, 5 / camera.zoom]);
    this.ctx.beginPath();
    this.ctx.moveTo(listenerEye.x, listenerEye.y);
    this.ctx.lineTo(speakerCenter.x, speakerCenter.y);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    if (showTalkingOverlay) {
      this.ctx.strokeStyle = 'rgba(58, 103, 140, 0.32)';
      this.ctx.lineWidth = 1 / camera.zoom;
      for (let i = 0; i < 2; i += 1) {
        const radius = (5 + i * 4) / camera.zoom;
        this.ctx.beginPath();
        this.ctx.arc(speakerCenter.x, speakerCenter.y, radius, -0.8, 0.8);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  private drawContactNetworkOverlay(
    world: World,
    camera: Camera,
    selectedEntityId: number,
    options: RenderOptions,
  ): void {
    const selectedCenter = this.entityCenter(world, selectedEntityId);
    if (!selectedCenter) {
      return;
    }

    const showParents = options.networkShowParents ?? true;
    const showKnown = options.networkShowKnown ?? true;
    const onlyOnScreen = options.networkShowOnlyOnScreen ?? true;
    const maxKnownEdges = Math.max(0, Math.round(options.networkMaxKnownEdges ?? 25));
    const focusRadius = Math.max(0, options.networkFocusRadius ?? 400);

    const parentIds: number[] = [];
    if (showParents) {
      const lineage = world.lineage.get(selectedEntityId);
      if (lineage?.motherId !== null && lineage?.motherId !== undefined && world.entities.has(lineage.motherId)) {
        parentIds.push(lineage.motherId);
      }
      if (
        lineage?.fatherId !== null &&
        lineage?.fatherId !== undefined &&
        world.entities.has(lineage.fatherId) &&
        !parentIds.includes(lineage.fatherId)
      ) {
        parentIds.push(lineage.fatherId);
      }
    }

    const positions = new Map<number, Vec2>();
    if (showKnown && maxKnownEdges > 0) {
      for (const id of world.entities) {
        const center = this.entityCenter(world, id);
        if (center) {
          positions.set(id, center);
        }
      }
    }

    const known = world.knowledge.get(selectedEntityId);
    const knownIds = showKnown && known
      ? selectTopKnownIds(known.known, positions, selectedCenter, maxKnownEdges, focusRadius).filter(
          (id) => id !== selectedEntityId && !parentIds.includes(id) && world.entities.has(id),
        )
      : [];

    const visible = (id: number): boolean => {
      const center = this.entityCenter(world, id);
      if (!center) {
        return false;
      }
      if (!onlyOnScreen) {
        return true;
      }
      const screen = camera.worldToScreen(center.x, center.y, this.canvas);
      return screen.x >= 0 && screen.x <= this.canvas.width && screen.y >= 0 && screen.y <= this.canvas.height;
    };

    const drawEdge = (toId: number, dashed: boolean): void => {
      const toCenter = this.entityCenter(world, toId);
      if (!toCenter || !visible(toId)) {
        return;
      }
      this.ctx.beginPath();
      this.ctx.moveTo(selectedCenter.x, selectedCenter.y);
      this.ctx.lineTo(toCenter.x, toCenter.y);
      if (dashed) {
        this.ctx.setLineDash([5 / camera.zoom, 4 / camera.zoom]);
      } else {
        this.ctx.setLineDash([]);
      }
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    };

    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.strokeStyle = 'rgba(34, 49, 71, 0.42)';
    this.ctx.lineWidth = 1.4 / camera.zoom;
    for (const parentId of parentIds) {
      drawEdge(parentId, false);
    }

    this.ctx.strokeStyle = 'rgba(45, 45, 45, 0.28)';
    this.ctx.lineWidth = 1 / camera.zoom;
    for (const knownId of knownIds) {
      drawEdge(knownId, true);
    }
    this.ctx.restore();

    const drawNodeRing = (id: number, color: string, radius: number, lineWidth: number): void => {
      const center = this.entityCenter(world, id);
      if (!center || !visible(id)) {
        return;
      }
      this.ctx.save();
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = lineWidth / camera.zoom;
      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, radius / camera.zoom, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    };

    drawNodeRing(selectedEntityId, 'rgba(17, 17, 17, 0.85)', 9, 2.4);
    for (const parentId of parentIds) {
      drawNodeRing(parentId, 'rgba(56, 73, 115, 0.7)', 7.5, 1.7);
    }
    for (const knownId of knownIds) {
      drawNodeRing(knownId, 'rgba(52, 52, 52, 0.38)', 6.6, 1.3);
    }
  }

  private entityCenter(world: World, entityId: number): Vec2 | null {
    const transform = world.transforms.get(entityId);
    const shape = world.shapes.get(entityId);
    if (!transform || !shape) {
      return null;
    }

    const geometry = world.geometries.get(entityId) ?? geometryFromComponents(shape, transform);
    return geometryCenter(geometry);
  }

  private drawFogPreviewRings(world: World, observer: Vec2, camera: Camera): void {
    const levels = [0.8, 0.5, 0.2];
    const fogDensity = Math.max(0, world.config.fogDensity);
    const fogMaxDistance = Math.max(0, world.config.fogMaxDistance);
    if (fogDensity <= 0 || fogMaxDistance <= 0) {
      return;
    }

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(54, 60, 74, 0.18)';
    this.ctx.lineWidth = 1 / camera.zoom;
    this.ctx.setLineDash([5 / camera.zoom, 7 / camera.zoom]);
    for (const level of levels) {
      const radius = fogRingRadiusForLevel(level, fogDensity, fogMaxDistance);
      if (radius === null || radius <= 0) {
        continue;
      }
      this.ctx.beginPath();
      this.ctx.arc(observer.x, observer.y, radius, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    this.ctx.setLineDash([]);
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

function colorForKillCount(kills: number): string {
  if (kills <= 0) {
    return '#232323';
  }
  if (kills <= 2) {
    return '#6c4a2c';
  }
  if (kills <= 5) {
    return '#7b2f24';
  }
  return '#4e0f0f';
}

function geometryCenter(
  geometry: ReturnType<typeof geometryFromComponents>,
): Vec2 {
  if (geometry.kind === 'circle') {
    return geometry.center;
  }
  if (geometry.kind === 'segment') {
    return {
      x: (geometry.a.x + geometry.b.x) / 2,
      y: (geometry.a.y + geometry.b.y) / 2,
    };
  }
  return polygonCentroid(geometry.vertices);
}
