import { geometryFromComponents } from '../core/entityGeometry';
import { eyePoseWorld } from '../core/eyePose';
import { getEyeWorldPosition } from '../core/eye';
import { fogDensityAt } from '../core/fogField';
import { isEntityOutside } from '../core/housing/dwelling';
import { doorPoseWorld } from '../core/housing/houseFactory';
import { Rank } from '../core/rank';
import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { HouseComponent, TransformComponent } from '../core/components';
import { normalize } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';
import type { Camera } from './camera';
import { contactCurveControlPoint, selectTopKnownIds } from './contactNetwork';
import type { EffectsManager } from './effects';
import { fogIntensityAtDistance, fogRingRadiusForLevel, visualAlpha } from './viewModifiers';
import type { FrameSnapshot } from '../ui/frameSnapshot';

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
  showEyes?: boolean;
  showPovCone?: boolean;
  showStillnessCues?: boolean;
  flatlanderHoverEntityId?: number | null;
  showHouseDoors?: boolean;
  showHouseOccupancy?: boolean;
  showHousingDebug?: boolean;
}

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private appVersionText = 'v0.0.0';

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

  setAppVersion(version: string): void {
    this.appVersionText = version.startsWith('v') ? version : `v${version}`;
  }

  render(
    world: World,
    camera: Camera,
    selectedEntityId: number | null,
    frameSnapshot: Readonly<FrameSnapshot>,
    options: RenderOptions = {},
  ): void {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.fillStyle = '#f3f1e8';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawEnvironmentOverlay(frameSnapshot);

    this.ctx.save();
    camera.applyToContext(this.ctx, this.canvas);

    if (frameSnapshot.showFogOverlay && frameSnapshot.fogDensity > 0) {
      this.drawFogFieldOverlay(frameSnapshot, camera);
    }

    if (options.showSouthZoneOverlay) {
      this.drawSouthZoneOverlay(world);
    }

    this.ctx.strokeStyle = '#8d8778';
    this.ctx.lineWidth = 2 / camera.zoom;
    this.ctx.strokeRect(0, 0, world.config.width, world.config.height);

    const selectedObserverEye =
      selectedEntityId !== null ? getEyeWorldPosition(world, selectedEntityId) : null;
    const fogPreviewStrength = Math.max(0, Math.min(1, options.fogPreviewStrength ?? 0.5));
    if (selectedObserverEye && options.fogPreviewEnabled) {
      this.drawFogFieldPreview(frameSnapshot, selectedObserverEye, fogPreviewStrength);
      if (options.fogPreviewRings) {
        this.drawFogPreviewRings(frameSnapshot, selectedObserverEye, camera);
      }
    }

    const ids = getSortedEntityIds(world);
    const ageHalfLifeTicks = 6_000;
    const showEyes = options.showEyes ?? true;
    const showStillnessCues = options.showStillnessCues ?? true;
    for (const id of ids) {
      if (!isEntityOutside(world, id) && !world.staticObstacles.has(id)) {
        continue;
      }

      const shape = world.shapes.get(id);
      const transform = world.transforms.get(id);
      if (!shape || !transform) {
        continue;
      }
      const isSelected = selectedEntityId === id;

      // Always draw from current transform+shape state. Cached collision geometries are built pre-resolution.
      const geometry = geometryFromComponents(shape, transform);
      const house = world.houses.get(id);
      if (house && geometry.kind === 'polygon') {
        this.drawHouse(
          geometry.vertices,
          house,
          transform,
          camera,
          options.showHouseDoors ?? true,
          options.showHouseOccupancy ?? false,
          world.houseOccupants.get(id)?.size ?? 0,
          isSelected,
        );
        continue;
      }

      const rank = world.ranks.get(id);
      if (!rank) {
        continue;
      }

      const isFlatlanderHovered =
        !isSelected &&
        options.flatlanderHoverEntityId !== null &&
        options.flatlanderHoverEntityId !== undefined &&
        options.flatlanderHoverEntityId === id;
      const isPregnantWoman = shape.kind === 'segment' && world.pregnancies.has(id);
      let fillColor = colorForRank(rank.rank);
      if (isPregnantWoman) {
        fillColor = '#d9578a';
      }
      const kills = world.combatStats.get(id)?.kills ?? 0;
      const killStrokeColor = colorForKillCount(kills);
      const defaultStroke =
        shape.kind === 'polygon' && shape.sides === 3 && !isSelected ? fillColor : '#232323';
      const pregnancyStrokeColor = isPregnantWoman ? '#d9578a' : defaultStroke;
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
          frameSnapshot.fogDensity,
          frameSnapshot.fogMaxDistance,
        );
        if ((options.fogPreviewHideBelowMin ?? false) && intensity < frameSnapshot.fogMinIntensity) {
          continue;
        }
        const fogFactor = intensity ** (1 + fogPreviewStrength * 2.5);
        entityAlpha *= 1 + (fogFactor - 1) * fogPreviewStrength;
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
        : isFlatlanderHovered
          ? '#d88a1f'
          : options.strokeByKills
            ? killStrokeColor
            : pregnancyStrokeColor;
      this.ctx.lineWidth = (isSelected ? 3 : isFlatlanderHovered ? 2.8 : 1.5) / camera.zoom;

      if (geometry.kind === 'circle') {
        this.ctx.beginPath();
        this.ctx.arc(geometry.center.x, geometry.center.y, geometry.radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
      } else if (geometry.kind === 'segment') {
        if (isPregnantWoman) {
          this.ctx.lineWidth = (isSelected ? 3.6 : 2.2) / camera.zoom;
        }
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

      if (isFlatlanderHovered) {
        const center = geometryCenter(geometry);
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(216, 138, 31, 0.9)';
        this.ctx.lineWidth = 1.6 / camera.zoom;
        this.ctx.beginPath();
        this.ctx.arc(center.x, center.y, 10 / camera.zoom, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }

      const eye = getEyeWorldPosition(world, id);
      if (showEyes && eye) {
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

      if (showStillnessCues) {
        const stillness = world.stillness.get(id);
        if (stillness) {
          this.drawStillnessCue(geometry, stillness.reason, camera);
        }
      }
    }

    if (showStillnessCues) {
      this.drawHandshakeLinks(world, camera);
    }

    if ((options.showPovCone ?? false) && selectedEntityId !== null) {
      this.drawSelectedPovCone(world, selectedEntityId, camera);
    }

    if (options.showContactNetwork && selectedEntityId !== null) {
      this.drawContactNetworkOverlay(world, camera, selectedEntityId, options);
    }

    if (options.showHearingOverlay && selectedEntityId !== null) {
      this.drawSelectedHearingOverlay(world, selectedEntityId, camera, options.showTalkingOverlay ?? false);
    }
    if (options.showHousingDebug && selectedEntityId !== null) {
      this.drawHousingDebugOverlay(world, selectedEntityId, camera);
    }

    options.effectsManager?.render(this.ctx, camera, selectedEntityId);

    this.ctx.restore();

    this.ctx.strokeStyle = '#8d8778';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(1, 1, this.canvas.width - 2, this.canvas.height - 2);
    this.drawSouthIndicator(frameSnapshot);
    if (options.debugClickPoint) {
      this.drawDebugClick(options.debugClickPoint, camera);
    }
  }

  private drawStillnessCue(
    geometry: ReturnType<typeof geometryFromComponents>,
    reason: 'beingFelt' | 'feeling' | 'yieldToLady' | 'waitForBearing' | 'manual',
    camera: Camera,
  ): void {
    const center = geometryCenter(geometry);
    const radius =
      geometry.kind === 'circle'
        ? geometry.radius + 4 / camera.zoom
        : geometry.kind === 'segment'
          ? Math.max(6 / camera.zoom, Math.hypot(geometry.b.x - geometry.a.x, geometry.b.y - geometry.a.y) * 0.55)
          : Math.max(
              8 / camera.zoom,
              ...geometry.vertices.map((vertex) => Math.hypot(vertex.x - center.x, vertex.y - center.y)),
            ) +
            3 / camera.zoom;

    const color =
      reason === 'beingFelt'
        ? 'rgba(43, 119, 96, 0.85)'
        : reason === 'feeling'
          ? 'rgba(95, 154, 162, 0.78)'
          : reason === 'manual'
            ? 'rgba(128, 103, 66, 0.78)'
            : 'rgba(88, 80, 66, 0.72)';

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1.4 / camera.zoom;
    this.ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  private drawHandshakeLinks(world: World, camera: Camera): void {
    const drawnPairs = new Set<string>();
    for (const [id, feeling] of world.feeling) {
      if (feeling.state !== 'feeling' || feeling.partnerId === null) {
        continue;
      }
      const partnerId = feeling.partnerId;
      const partner = world.feeling.get(partnerId);
      if (!partner || partner.state !== 'beingFelt' || partner.partnerId !== id) {
        continue;
      }

      const lo = Math.min(id, partnerId);
      const hi = Math.max(id, partnerId);
      const key = `${lo}:${hi}`;
      if (drawnPairs.has(key)) {
        continue;
      }
      drawnPairs.add(key);

      const aTransform = world.transforms.get(id);
      const bTransform = world.transforms.get(partnerId);
      if (!aTransform || !bTransform) {
        continue;
      }

      this.ctx.save();
      this.ctx.strokeStyle = 'rgba(43, 119, 96, 0.38)';
      this.ctx.lineWidth = 1.1 / camera.zoom;
      this.ctx.setLineDash([3 / camera.zoom, 4 / camera.zoom]);
      this.ctx.beginPath();
      this.ctx.moveTo(aTransform.position.x, aTransform.position.y);
      this.ctx.lineTo(bTransform.position.x, bTransform.position.y);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  private drawEnvironmentOverlay(snapshot: Readonly<FrameSnapshot>): void {
    if (snapshot.showRainOverlay && snapshot.isRaining) {
      this.drawRainOverlay(snapshot.tick);
    }
  }

  private drawFogFieldOverlay(snapshot: Readonly<FrameSnapshot>, camera: Camera): void {
    const cols = 36;
    const rows = 24;
    const worldWidth = Math.max(1, snapshot.fogField.width);
    const worldHeight = Math.max(1, snapshot.fogField.height);
    const cellWidth = worldWidth / cols;
    const cellHeight = worldHeight / rows;
    const baseDensity = Math.max(1e-6, snapshot.fogField.baseDensity);

    this.ctx.save();
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const x = col * cellWidth;
        const y = row * cellHeight;
        const localDensity = fogDensityAt(snapshot.fogField, {
          x: x + cellWidth * 0.5,
          y: y + cellHeight * 0.5,
        });
        const relative = localDensity / baseDensity;
        const alpha = Math.max(
          0,
          Math.min(0.22, localDensity * 8 + Math.max(0, relative - 1) * 0.05 + (camera.zoom - 1) * 0.005),
        );
        if (alpha < 0.002) {
          continue;
        }
        this.ctx.fillStyle = `rgba(88, 95, 108, ${alpha.toFixed(3)})`;
        this.ctx.fillRect(x, y, cellWidth + 0.5, cellHeight + 0.5);
      }
    }
    this.ctx.restore();
  }

  private drawRainOverlay(tick: number): void {
    const phase = tick % 240;
    const spacing = 36;
    const columns = Math.ceil((this.canvas.width + 120) / spacing);
    const diagonalX = -7;
    const diagonalY = 18;

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(86, 103, 124, 0.34)';
    this.ctx.lineWidth = 1;
    this.ctx.lineCap = 'round';

    for (let i = 0; i < columns; i += 1) {
      const x = ((i * spacing + phase * 2.4) % (this.canvas.width + 120)) - 60;
      const y = (((i * 97 + phase * 6.5) % (this.canvas.height + 80)) - 40);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x + diagonalX, y + diagonalY);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  private drawSouthIndicator(snapshot: Readonly<FrameSnapshot>): void {
    const x = this.canvas.width - 92;
    const y = 18;

    this.ctx.save();
    this.ctx.font = '12px Trebuchet MS, sans-serif';
    this.ctx.fillStyle = '#2e2b25';
    this.ctx.fillText('SOUTH', x, y);
    const versionText = this.appVersionText;
    const versionWidth = this.ctx.measureText(versionText).width;
    this.ctx.fillText(versionText, this.canvas.width - versionWidth - 10, 12);

    const fogLabel = `Fog ${snapshot.fogDensity.toFixed(3)}`;
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    this.ctx.fillText(fogLabel, this.canvas.width - 120, 28);
    if (snapshot.isRaining) {
      this.drawRainBadge(this.canvas.width - 120, 33);
    }

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

  private drawRainBadge(x: number, y: number): void {
    const width = 40;
    const height = 14;
    const radius = 4;
    const x2 = x + width;
    const y2 = y + height;

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(58, 103, 140, 0.88)';
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x2 - radius, y);
    this.ctx.quadraticCurveTo(x2, y, x2, y + radius);
    this.ctx.lineTo(x2, y2 - radius);
    this.ctx.quadraticCurveTo(x2, y2, x2 - radius, y2);
    this.ctx.lineTo(x + radius, y2);
    this.ctx.quadraticCurveTo(x, y2, x, y2 - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = 'rgba(248, 250, 255, 0.98)';
    this.ctx.font = '10px Trebuchet MS, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('RAIN', x + width * 0.5, y + height * 0.5 + 0.2);
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
    const speakerShape = world.shapes.get(hearingHit.otherId);
    const speakerGeometry = speakerShape ? geometryFromComponents(speakerShape, speakerTransform) : null;
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

  private drawSelectedPovCone(world: World, selectedEntityId: number, camera: Camera): void {
    const pose = eyePoseWorld(world, selectedEntityId);
    if (!pose) {
      return;
    }

    const visionRange = world.vision.get(selectedEntityId)?.range ?? 120;
    const radius = Math.max(20, visionRange);
    const baseAngle = Math.atan2(pose.forwardWorld.y, pose.forwardWorld.x);
    const halfFov = Math.max(Math.PI / 12, Math.min(Math.PI, pose.fovRad * 0.5));

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(34, 33, 30, 0.55)';
    this.ctx.fillStyle = 'rgba(34, 33, 30, 0.06)';
    this.ctx.lineWidth = 1.2 / camera.zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(pose.eyeWorld.x, pose.eyeWorld.y);
    this.ctx.arc(
      pose.eyeWorld.x,
      pose.eyeWorld.y,
      radius,
      baseAngle - halfFov,
      baseAngle + halfFov,
    );
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
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

    const drawEdge = (
      toId: number,
      style: { dotted: boolean; stroke: string; width: number },
    ): void => {
      const toCenter = this.entityCenter(world, toId);
      if (!toCenter || !visible(toId)) {
        return;
      }
      const control = contactCurveControlPoint(selectedCenter, toCenter, selectedEntityId, toId);
      this.ctx.beginPath();
      this.ctx.moveTo(selectedCenter.x, selectedCenter.y);
      this.ctx.quadraticCurveTo(control.x, control.y, toCenter.x, toCenter.y);
      this.ctx.strokeStyle = style.stroke;
      this.ctx.lineWidth = style.width / camera.zoom;
      this.ctx.setLineDash(style.dotted ? [1.5 / camera.zoom, 3 / camera.zoom] : []);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    };

    this.ctx.save();
    this.ctx.lineCap = 'round';
    for (const parentId of parentIds) {
      drawEdge(parentId, {
        dotted: false,
        stroke: 'rgba(49, 92, 170, 0.78)',
        width: 1.9,
      });
    }

    for (const knownId of knownIds) {
      drawEdge(knownId, {
        dotted: true,
        stroke: 'rgba(121, 80, 150, 0.72)',
        width: 1.35,
      });
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

    drawNodeRing(selectedEntityId, 'rgba(17, 17, 17, 0.9)', 9.8, 2.8);
    for (const parentId of parentIds) {
      drawNodeRing(parentId, 'rgba(49, 92, 170, 0.82)', 8, 2);
    }
    for (const knownId of knownIds) {
      drawNodeRing(knownId, 'rgba(121, 80, 150, 0.72)', 6.8, 1.5);
    }
  }

  private entityCenter(world: World, entityId: number): Vec2 | null {
    const transform = world.transforms.get(entityId);
    const shape = world.shapes.get(entityId);
    if (!transform || !shape) {
      return null;
    }

    const geometry = geometryFromComponents(shape, transform);
    return geometryCenter(geometry);
  }

  private drawFogPreviewRings(snapshot: Readonly<FrameSnapshot>, observer: Vec2, camera: Camera): void {
    const levels = [0.85, 0.65, 0.45, 0.25];
    const fogDensity = Math.max(0, snapshot.fogDensity);
    const fogMaxDistance = Math.max(0, snapshot.fogMaxDistance);
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

  private drawFogFieldPreview(snapshot: Readonly<FrameSnapshot>, observer: Vec2, strength: number): void {
    const fogDensity = Math.max(0, snapshot.fogDensity);
    const fogMaxDistance = Math.max(0, snapshot.fogMaxDistance);
    if (fogDensity <= 0 || fogMaxDistance <= 0 || strength <= 0) {
      return;
    }

    const farRadius = Math.max(1, fogMaxDistance);
    const gradient = this.ctx.createRadialGradient(
      observer.x,
      observer.y,
      0,
      observer.x,
      observer.y,
      farRadius,
    );
    gradient.addColorStop(0, 'rgba(64, 68, 78, 0)');
    gradient.addColorStop(0.55, `rgba(64, 68, 78, ${(0.08 * strength).toFixed(3)})`);
    gradient.addColorStop(1, `rgba(64, 68, 78, ${(0.2 * strength).toFixed(3)})`);

    this.ctx.save();
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(
      observer.x - farRadius,
      observer.y - farRadius,
      farRadius * 2,
      farRadius * 2,
    );
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

  private drawHouse(
    vertices: Vec2[],
    house: HouseComponent,
    transform: TransformComponent,
    camera: Camera,
    showDoors: boolean,
    showOccupancy: boolean,
    occupantCount: number,
    selected: boolean,
  ): void {
    const first = vertices[0];
    if (!first) {
      return;
    }
    const center = polygonCentroid(vertices);
    const { minY, maxY } = polygonYRange(vertices);
    const roofApexIndex = northmostVertexIndex(vertices);
    const roofLeft = vertices[(roofApexIndex - 1 + vertices.length) % vertices.length];
    const roofApex = vertices[roofApexIndex];
    const roofRight = vertices[(roofApexIndex + 1) % vertices.length];

    this.ctx.save();
    const houseFill = this.ctx.createLinearGradient(0, minY, 0, maxY);
    houseFill.addColorStop(0, 'rgba(121, 109, 93, 0.26)');
    houseFill.addColorStop(1, 'rgba(103, 94, 82, 0.18)');
    this.ctx.fillStyle = houseFill;
    this.ctx.strokeStyle = selected ? 'rgba(28, 26, 22, 0.9)' : 'rgba(77, 71, 63, 0.78)';
    this.ctx.lineWidth = (selected ? 2.1 : 1.25) / camera.zoom;
    this.ctx.lineJoin = 'round';
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

    // Part I §2: houses are roofed on the north side; render a subtle roof plane.
    if (roofLeft && roofApex && roofRight) {
      this.ctx.fillStyle = selected ? 'rgba(70, 60, 50, 0.34)' : 'rgba(70, 60, 50, 0.27)';
      this.ctx.beginPath();
      this.ctx.moveTo(roofLeft.x, roofLeft.y);
      this.ctx.lineTo(roofApex.x, roofApex.y);
      this.ctx.lineTo(roofRight.x, roofRight.y);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(56, 49, 42, 0.72)';
      this.ctx.lineWidth = 0.95 / camera.zoom;
      this.ctx.beginPath();
      this.ctx.moveTo(roofApex.x, roofApex.y);
      this.ctx.lineTo((roofLeft.x + roofRight.x) * 0.5, (roofLeft.y + roofRight.y) * 0.5);
      this.ctx.stroke();
    }

    if (showDoors) {
      const eastDoor = doorPoseWorld(transform, house.doorEast);
      const westDoor = doorPoseWorld(transform, house.doorWest);
      this.drawDoorMarker(
        eastDoor.midpoint,
        eastDoor.normalInward,
        house.doorEast.sizeFactor,
        '#c67a32',
        camera,
      );
      this.drawDoorMarker(
        westDoor.midpoint,
        westDoor.normalInward,
        house.doorWest.sizeFactor,
        '#396887',
        camera,
      );
    }

    if (showOccupancy) {
      const badgeRadius = 6.2 / camera.zoom;
      this.ctx.fillStyle = 'rgba(30, 28, 24, 0.84)';
      this.ctx.beginPath();
      this.ctx.arc(center.x, center.y, badgeRadius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(245, 243, 236, 0.85)';
      this.ctx.lineWidth = 0.9 / camera.zoom;
      this.ctx.stroke();
      this.ctx.fillStyle = '#f9f7ef';
      this.ctx.font = `${Math.max(6, Math.round(8 / camera.zoom))}px Trebuchet MS, sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(String(Math.max(0, occupantCount)), center.x, center.y + 0.4 / camera.zoom);
    }
    this.ctx.restore();
  }

  private drawDoorMarker(
    position: Vec2,
    normalInward: Vec2,
    sizeFactor: number,
    color: string,
    camera: Camera,
  ): void {
    const tangent = normalize({ x: -normalInward.y, y: normalInward.x });
    const markerHalfLength = (2.4 + sizeFactor * 1.8) / camera.zoom;
    this.ctx.save();
    this.ctx.lineCap = 'round';
    this.ctx.beginPath();
    this.ctx.moveTo(
      position.x - tangent.x * markerHalfLength,
      position.y - tangent.y * markerHalfLength,
    );
    this.ctx.lineTo(
      position.x + tangent.x * markerHalfLength,
      position.y + tangent.y * markerHalfLength,
    );
    this.ctx.strokeStyle = 'rgba(33, 29, 24, 0.9)';
    this.ctx.lineWidth = (3.1 + sizeFactor) / camera.zoom;
    this.ctx.stroke();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = (1.9 + sizeFactor * 0.55) / camera.zoom;
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

  private drawHousingDebugOverlay(world: World, selectedEntityId: number, camera: Camera): void {
    const debug = world.houseApproachDebug.get(selectedEntityId);
    if (!debug) {
      return;
    }

    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(49, 92, 170, 0.75)';
    this.ctx.fillStyle = 'rgba(49, 92, 170, 0.18)';
    this.ctx.lineWidth = 1.2 / camera.zoom;
    this.ctx.beginPath();
    this.ctx.arc(debug.doorPoint.x, debug.doorPoint.y, Math.max(2, debug.enterRadius), 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.strokeStyle = 'rgba(216, 138, 31, 0.85)';
    this.ctx.lineWidth = 1.35 / camera.zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(debug.contactPoint.x, debug.contactPoint.y);
    this.ctx.lineTo(debug.doorPoint.x, debug.doorPoint.y);
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(216, 138, 31, 0.9)';
    this.ctx.beginPath();
    this.ctx.arc(debug.contactPoint.x, debug.contactPoint.y, 2.1 / camera.zoom, 0, Math.PI * 2);
    this.ctx.fill();
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

function northmostVertexIndex(vertices: Vec2[]): number {
  let index = 0;
  let bestY = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i += 1) {
    const vertex = vertices[i];
    if (!vertex) {
      continue;
    }
    if (vertex.y < bestY) {
      bestY = vertex.y;
      index = i;
    }
  }
  return index;
}

function polygonYRange(vertices: Vec2[]): { minY: number; maxY: number } {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    if (!vertex) {
      continue;
    }
    minY = Math.min(minY, vertex.y);
    maxY = Math.max(maxY, vertex.y);
  }
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { minY: 0, maxY: 0 };
  }
  if (Math.abs(maxY - minY) < 1e-6) {
    return { minY, maxY: minY + 1 };
  }
  return { minY, maxY };
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
