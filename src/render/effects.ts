import type { WorldEvent } from '../core/events';
import { eventInvolvedIds } from '../core/events';
import type { Vec2 } from '../geometry/vector';
import { clamp } from '../geometry/vector';
import type { Camera } from './camera';

export type Effect =
  | {
      kind: 'pulse';
      pos: Vec2;
      ttl: number;
      age: number;
      strength: number;
      style: 'touch' | 'birth';
      eventType: WorldEvent['type'];
      involvedIds: number[];
    }
  | {
      kind: 'ring';
      pos: Vec2;
      ttl: number;
      age: number;
      radius: number;
      subtle?: boolean;
      eventType: WorldEvent['type'];
      involvedIds: number[];
    }
  | {
      kind: 'spark';
      pos: Vec2;
      ttl: number;
      age: number;
      intensity: number;
      eventType: WorldEvent['type'];
      involvedIds: number[];
    }
  | {
      kind: 'marker';
      pos: Vec2;
      ttl: number;
      age: number;
      shape: 'x' | 'dot' | 'pair' | 'plus';
      eventType: WorldEvent['type'];
      involvedIds: number[];
    };

export interface EventHighlightSettings {
  enabled: boolean;
  intensity: number;
  capPerTick: number;
  showFeeling: boolean;
  focusOnSelected: boolean;
}

const DEFAULT_SETTINGS: EventHighlightSettings = {
  enabled: true,
  intensity: 1,
  capPerTick: 120,
  showFeeling: true,
  focusOnSelected: false,
};

const PEACE_CRY_TTL_SECONDS = 0.38;
const PEACE_CRY_RADIUS_FACTOR = 0.32;
const PEACE_CRY_MIN_RADIUS = 3;
const PEACE_CRY_MAX_RADIUS = 90;

export function effectFromEvent(event: WorldEvent): Effect | null {
  const involvedIds = eventInvolvedIds(event);
  switch (event.type) {
    case 'handshakeStart':
      return {
        kind: 'marker',
        pos: event.pos,
        ttl: 0.3,
        age: 0,
        shape: 'dot',
        eventType: event.type,
        involvedIds,
      };
    case 'touch':
      return {
        kind: 'pulse',
        pos: event.pos,
        ttl: 0.24,
        age: 0,
        strength: 0.8,
        style: 'touch',
        eventType: event.type,
        involvedIds,
      };
    case 'handshake':
      return {
        kind: 'marker',
        pos: event.pos,
        ttl: 0.35,
        age: 0,
        shape: 'pair',
        eventType: event.type,
        involvedIds,
      };
    case 'peaceCry':
      return {
        kind: 'ring',
        pos: event.pos,
        ttl: PEACE_CRY_TTL_SECONDS,
        age: 0,
        radius: clamp(event.radius * PEACE_CRY_RADIUS_FACTOR, PEACE_CRY_MIN_RADIUS, PEACE_CRY_MAX_RADIUS),
        subtle: true,
        eventType: event.type,
        involvedIds,
      };
    case 'stab':
      return {
        kind: 'spark',
        pos: event.pos,
        ttl: 0.2,
        age: 0,
        intensity: clamp(event.sharpness, 0, 1),
        eventType: event.type,
        involvedIds,
      };
    case 'death':
      return {
        kind: 'marker',
        pos: event.pos,
        ttl: 0.8,
        age: 0,
        shape: 'x',
        eventType: event.type,
        involvedIds,
      };
    case 'birth':
      return {
        kind: 'pulse',
        pos: event.pos,
        ttl: 0.6,
        age: 0,
        strength: 0.7,
        style: 'birth',
        eventType: event.type,
        involvedIds,
      };
    case 'regularized':
      return {
        kind: 'marker',
        pos: event.pos,
        ttl: 0.75,
        age: 0,
        shape: 'plus',
        eventType: event.type,
        involvedIds,
      };
    default:
      return null;
  }
}

export class EffectsManager {
  private effects: Effect[] = [];
  private settings: EventHighlightSettings = { ...DEFAULT_SETTINGS };

  setSettings(settings: Partial<EventHighlightSettings>): void {
    if (settings.enabled !== undefined) {
      this.settings.enabled = settings.enabled;
    }

    if (settings.intensity !== undefined) {
      this.settings.intensity = Math.max(0, settings.intensity);
    }

    if (settings.capPerTick !== undefined) {
      this.settings.capPerTick = Math.max(1, Math.round(settings.capPerTick));
    }
    if (settings.showFeeling !== undefined) {
      this.settings.showFeeling = settings.showFeeling;
    }
    if (settings.focusOnSelected !== undefined) {
      this.settings.focusOnSelected = settings.focusOnSelected;
    }
  }

  ingest(events: WorldEvent[]): void {
    if (!this.settings.enabled) {
      return;
    }

    const perTickCounts = new Map<number, number>();
    for (const event of events) {
      const currentCount = perTickCounts.get(event.tick) ?? 0;
      if (currentCount >= this.settings.capPerTick) {
        continue;
      }

      const effect = effectFromEvent(event);
      if (!effect) {
        continue;
      }

      perTickCounts.set(event.tick, currentCount + 1);
      this.effects.push(effect);
    }
  }

  update(dt: number): void {
    if (dt <= 0 || this.effects.length === 0) {
      return;
    }

    for (const effect of this.effects) {
      effect.age += dt;
    }

    this.effects = this.effects.filter((effect) => effect.age < effect.ttl);
  }

  render(ctx: CanvasRenderingContext2D, camera: Camera, selectedEntityId: number | null): void {
    if (!this.settings.enabled || this.effects.length === 0) {
      return;
    }

    for (const effect of this.effects) {
      if (
        !this.settings.showFeeling &&
        (effect.eventType === 'touch' ||
          effect.eventType === 'handshakeStart' ||
          effect.eventType === 'handshake')
      ) {
        continue;
      }

      if (
        this.settings.focusOnSelected &&
        selectedEntityId !== null &&
        !effect.involvedIds.includes(selectedEntityId)
      ) {
        continue;
      }

      const progress = clamp(effect.age / effect.ttl, 0, 1);
      const alpha = clamp((1 - progress) * this.settings.intensity, 0, 1);
      if (alpha <= 0) {
        continue;
      }

      if (effect.kind === 'pulse') {
        ctx.save();
        if (effect.style === 'touch') {
          const ringRadius = (2 + progress * 6 * effect.strength) / camera.zoom;
          const dotRadius = (1.8 + effect.strength) / camera.zoom;
          ctx.fillStyle = `rgba(201, 157, 76, ${(alpha * 0.9).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(effect.pos.x, effect.pos.y, dotRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(201, 157, 76, ${(alpha * 0.55).toFixed(3)})`;
          ctx.lineWidth = 1.2 / camera.zoom;
          ctx.beginPath();
          ctx.arc(effect.pos.x, effect.pos.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          const ringRadius = (2.8 + progress * 9 * effect.strength) / camera.zoom;
          ctx.strokeStyle = `rgba(96, 132, 92, ${(alpha * 0.75).toFixed(3)})`;
          ctx.lineWidth = 1.4 / camera.zoom;
          ctx.beginPath();
          ctx.arc(effect.pos.x, effect.pos.y, ringRadius, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = `rgba(96, 132, 92, ${(alpha * 0.85).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(effect.pos.x, effect.pos.y, 2.1 / camera.zoom, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        continue;
      }

      if (effect.kind === 'ring') {
        const radius = (effect.radius * progress) / camera.zoom;
        const ringAlpha = effect.subtle ? alpha * 0.22 : alpha;
        ctx.save();
        ctx.strokeStyle = `rgba(58, 103, 140, ${ringAlpha.toFixed(3)})`;
        ctx.lineWidth = (effect.subtle ? 0.75 : 1.6) / camera.zoom;
        if (effect.subtle) {
          ctx.setLineDash([4 / camera.zoom, 5 / camera.zoom]);
        }
        ctx.beginPath();
        ctx.arc(effect.pos.x, effect.pos.y, Math.max(1 / camera.zoom, radius), 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        continue;
      }

      if (effect.kind === 'spark') {
        const size = (2.8 + effect.intensity * 6.5) / camera.zoom;
        const inner = 1 / camera.zoom;
        const baseAngle = 0.35;
        ctx.save();
        ctx.strokeStyle = `rgba(184, 64, 64, ${(alpha * 0.9).toFixed(3)})`;
        ctx.lineWidth = (1 + effect.intensity * 0.9) / camera.zoom;
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const angle = baseAngle + i * (Math.PI / 2);
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          ctx.moveTo(effect.pos.x + cos * inner, effect.pos.y + sin * inner);
          ctx.lineTo(effect.pos.x + cos * size, effect.pos.y + sin * size);
        }
        ctx.stroke();
        ctx.restore();
        continue;
      }

      if (effect.kind === 'marker') {
        ctx.save();
        ctx.strokeStyle = `rgba(35, 31, 27, ${alpha.toFixed(3)})`;
        ctx.fillStyle = `rgba(35, 31, 27, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.5 / camera.zoom;

        if (effect.shape === 'x') {
          const size = 5 / camera.zoom;
          ctx.beginPath();
          ctx.moveTo(effect.pos.x - size, effect.pos.y - size);
          ctx.lineTo(effect.pos.x + size, effect.pos.y + size);
          ctx.moveTo(effect.pos.x - size, effect.pos.y + size);
          ctx.lineTo(effect.pos.x + size, effect.pos.y - size);
          ctx.stroke();
        } else if (effect.shape === 'pair') {
          const gap = 4 / camera.zoom;
          const len = 3 / camera.zoom;
          ctx.beginPath();
          ctx.moveTo(effect.pos.x - gap, effect.pos.y - len);
          ctx.lineTo(effect.pos.x - gap, effect.pos.y + len);
          ctx.moveTo(effect.pos.x + gap, effect.pos.y - len);
          ctx.lineTo(effect.pos.x + gap, effect.pos.y + len);
          ctx.stroke();
        } else if (effect.shape === 'plus') {
          const size = 4 / camera.zoom;
          ctx.beginPath();
          ctx.moveTo(effect.pos.x - size, effect.pos.y);
          ctx.lineTo(effect.pos.x + size, effect.pos.y);
          ctx.moveTo(effect.pos.x, effect.pos.y - size);
          ctx.lineTo(effect.pos.x, effect.pos.y + size);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(effect.pos.x, effect.pos.y, 2.6 / camera.zoom, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }

  clear(): void {
    this.effects.length = 0;
  }
}
