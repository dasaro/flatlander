import type { EventType, TickSummary } from '../ui/eventAnalytics';
import { TimelineSelectionState } from '../ui/timelineSelectionState';
import type { RainInterval } from '../ui/rainTimelineStore';

export interface TimelineRenderConfig {
  splitByRank: boolean;
  selectedTypes: EventType[];
  selectedRankKeys: string[];
  showLegend: boolean;
  tickStart: number;
  tickEnd: number;
  showRainTrack?: boolean;
  rainIntervals?: RainInterval[];
}

const CONTENT_LEFT = 48;
const CONTENT_RIGHT_PADDING = 12;
const TOP_PADDING = 10;
const BOTTOM_PADDING = 24;
const MIN_DIAMOND_RADIUS = 2.8;
const MAX_DIAMOND_RADIUS = 6.8;
const RAIN_LINE_COLOR = 'rgba(58, 103, 140, 0.95)';

const TYPE_COLORS: Record<EventType, string> = {
  handshakeStart: '#5f9aa2',
  handshakeAttemptFailed: '#8e5b2d',
  touch: '#c99d4c',
  handshake: '#2b7760',
  peaceCry: '#3a678c',
  stab: '#b84040',
  death: '#2c2a24',
  birth: '#60845c',
  houseEnter: '#4f7f58',
  houseExit: '#4b6582',
  regularized: '#6c57a8',
};

const TIMELINE_TYPE_ORDER: EventType[] = [
  'handshakeAttemptFailed',
  'handshake',
  'houseEnter',
  'houseExit',
  'death',
  'birth',
  'regularized',
];

function typeLabel(type: EventType): string {
  switch (type) {
    case 'handshakeAttemptFailed':
      return 'Handshake Failed';
    case 'handshake':
      return 'Handshake';
    case 'houseEnter':
      return 'Enter House';
    case 'houseExit':
      return 'Exit House';
    case 'death':
      return 'Death';
    case 'birth':
      return 'Birth';
    case 'regularized':
      return 'Regularized';
    default:
      return type;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const value = hex.replace('#', '');
  if (value.length !== 6) {
    return { r: 0, g: 0, b: 0 };
  }
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return { r: 0, g: 0, b: 0 };
  }
  return { r, g, b };
}

function shadeByIntensity(baseColor: string, intensity: number): string {
  const { r, g, b } = hexToRgb(baseColor);
  const normalized = Math.max(0, Math.min(1, intensity));
  const alpha = 0.28 + normalized * 0.7;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
}

function uniqueTypes(types: EventType[]): EventType[] {
  const ordered = types.length > 0 ? types : TIMELINE_TYPE_ORDER;
  const seen = new Set<EventType>();
  const out: EventType[] = [];
  for (const type of ordered) {
    if (!TIMELINE_TYPE_ORDER.includes(type) || seen.has(type)) {
      continue;
    }
    seen.add(type);
    out.push(type);
  }
  return out;
}

export class EventTimelineRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private summaries: TickSummary[] = [];
  private visibleTypes: EventType[] = [];
  private readonly selection = new TimelineSelectionState();
  private summaryXs: number[] = [];
  private tickStart = 0;
  private tickEnd = 0;
  private showRainTrack = false;
  private rainIntervals: RainInterval[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly tooltipElement: HTMLElement,
  ) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Event timeline canvas 2D context unavailable.');
    }
    this.ctx = context;

    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const xPx = (event.clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width));
      const contentLeft = CONTENT_LEFT;
      const contentRight = this.canvas.width - CONTENT_RIGHT_PADDING;
      if (xPx < contentLeft || xPx > contentRight) {
        this.selection.setHovered(null);
      } else {
        this.selection.setHovered(this.getNearestSummaryIndexAtCanvasX(xPx));
      }
      this.updateTooltip();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.selection.setHovered(null);
      this.updateTooltip();
    });

    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const xPx = (event.clientX - rect.left) * (this.canvas.width / Math.max(1, rect.width));
      const contentLeft = CONTENT_LEFT;
      const contentRight = this.canvas.width - CONTENT_RIGHT_PADDING;
      if (xPx < contentLeft || xPx > contentRight) {
        this.selection.clearPin();
      } else {
        this.selection.togglePinned(this.getNearestSummaryIndexAtCanvasX(xPx));
      }
      this.updateTooltip();
    });
  }

  render(summaries: TickSummary[], config: TimelineRenderConfig): void {
    this.resizeForDisplay();
    this.summaries = summaries;
    this.visibleTypes = uniqueTypes(config.selectedTypes);
    this.tickStart = Math.max(0, Math.floor(config.tickStart));
    this.tickEnd = Math.max(this.tickStart, Math.floor(config.tickEnd));
    this.showRainTrack = Boolean(config.showRainTrack);
    this.rainIntervals = config.rainIntervals ?? [];

    if (
      this.selection.pinnedIndex !== null &&
      (this.selection.pinnedIndex < 0 || this.selection.pinnedIndex >= summaries.length)
    ) {
      this.selection.clearPin();
    }
    if (
      this.selection.hoveredIndex !== null &&
      (this.selection.hoveredIndex < 0 || this.selection.hoveredIndex >= summaries.length)
    ) {
      this.selection.setHovered(null);
    }

    const { width, height } = this.canvas;
    const left = CONTENT_LEFT;
    const right = width - CONTENT_RIGHT_PADDING;
    const top = TOP_PADDING;
    const bottom = height - BOTTOM_PADDING;
    const contentWidth = Math.max(1, right - left);
    const contentHeight = Math.max(1, bottom - top);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#fffdf8';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = '#9e957f';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(left, bottom + 0.5);
    this.ctx.lineTo(right, bottom + 0.5);
    this.ctx.moveTo(left + 0.5, top);
    this.ctx.lineTo(left + 0.5, bottom);
    this.ctx.stroke();

    if (this.visibleTypes.length === 0 && !this.showRainTrack) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('Enable at least one timeline event type', left + 8, top + 14);
      this.ctx.fillStyle = '#2b2721';
      this.ctx.font = '11px Trebuchet MS, sans-serif';
      this.ctx.fillText('eventful slices: 0', left, height - 6);
      this.ctx.fillText(`ticks ${config.tickStart}..${config.tickEnd}`, right - 120, height - 6);
      this.updateTooltip();
      return;
    }

    const tickSpan = Math.max(1, this.tickEnd - this.tickStart);
    const xFromTick = (tick: number): number => {
      const clampedTick = Math.max(this.tickStart, Math.min(this.tickEnd, tick));
      const normalized = (clampedTick - this.tickStart) / tickSpan;
      return left + normalized * contentWidth;
    };

    const rows: Array<{ kind: 'rain' } | { kind: 'event'; type: EventType }> = [];
    if (this.showRainTrack) {
      rows.push({ kind: 'rain' });
    }
    for (const type of this.visibleTypes) {
      rows.push({ kind: 'event', type });
    }
    const rowHeight = contentHeight / Math.max(1, rows.length);
    const rowCenters = rows.map((_, index) => top + rowHeight * (index + 0.5));
    const perTypeMax = new Map<EventType, number>();
    for (const type of this.visibleTypes) {
      perTypeMax.set(
        type,
        Math.max(1, ...summaries.map((summary) => summary.countsByType[type] ?? 0)),
      );
    }

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const y = rowCenters[rowIndex];
      if (!row || y === undefined) {
        continue;
      }
      this.ctx.strokeStyle = 'rgba(88, 78, 62, 0.18)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(left, y + 0.5);
      this.ctx.lineTo(right, y + 0.5);
      this.ctx.stroke();

      this.ctx.fillStyle = '#4e4437';
      this.ctx.font = '11px Trebuchet MS, sans-serif';
      this.ctx.textAlign = 'right';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(row.kind === 'rain' ? 'Rain' : typeLabel(row.type), left - 6, y);
    }

    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'alphabetic';

    if (this.showRainTrack) {
      const rainRowIndex = rows.findIndex((row) => row.kind === 'rain');
      const rainY = rainRowIndex >= 0 ? rowCenters[rainRowIndex] : undefined;
      if (rainY !== undefined) {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(88, 78, 62, 0.22)';
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(left, rainY);
        this.ctx.lineTo(right, rainY);
        this.ctx.stroke();

        this.ctx.strokeStyle = RAIN_LINE_COLOR;
        this.ctx.lineWidth = Math.max(2.2, rowHeight * 0.26);
        this.ctx.lineCap = 'round';
        for (const interval of this.rainIntervals) {
          if (interval.endTick < this.tickStart || interval.startTick > this.tickEnd) {
            continue;
          }
          const startX = xFromTick(interval.startTick);
          const endX = xFromTick(interval.endTick);
          this.ctx.beginPath();
          this.ctx.moveTo(startX, rainY);
          this.ctx.lineTo(endX, rainY);
          this.ctx.stroke();
        }
        this.ctx.restore();
      }
    }

    this.summaryXs = summaries.map((summary) => xFromTick(summary.tick));
    const pitch = summaries.length <= 1 ? contentWidth : contentWidth / (summaries.length - 1);
    const rowRadiusLimit = Math.max(2.2, Math.min(7.2, rowHeight * 0.35));
    const maxRadius = Math.min(MAX_DIAMOND_RADIUS, rowRadiusLimit);

    for (let i = 0; i < summaries.length; i += 1) {
      const summary = summaries[i];
      if (!summary) {
        continue;
      }
      const xCenter = this.summaryXs[i] ?? (summaries.length <= 1 ? left + contentWidth / 2 : left + i * pitch);

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex];
        const yCenter = rowCenters[rowIndex];
        if (!row || row.kind !== 'event' || yCenter === undefined) {
          continue;
        }
        const type = row.type;
        const count = summary.countsByType[type] ?? 0;
        if (count <= 0) {
          continue;
        }
        const maxCount = perTypeMax.get(type) ?? 1;
        const intensity = Math.max(0, Math.min(1, count / maxCount));
        const radius =
          MIN_DIAMOND_RADIUS + (maxRadius - MIN_DIAMOND_RADIUS) * Math.sqrt(intensity);
        const color = shadeByIntensity(TYPE_COLORS[type], intensity);
        this.drawDiamond(xCenter, yCenter, radius, color);
      }

      if (this.selection.effectiveIndex === i) {
        const highlightWidth = Math.max(4, pitch * 0.74);
        this.ctx.strokeStyle = this.selection.pinnedIndex === i ? '#1e1b16' : '#3b352c';
        this.ctx.lineWidth = this.selection.pinnedIndex === i ? 1.6 : 1;
        this.ctx.strokeRect(xCenter - highlightWidth * 0.5, top, highlightWidth, contentHeight);
      }
    }

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    this.ctx.fillText(`eventful slices: ${summaries.length}`, left, height - 6);
    this.ctx.fillText(`ticks ${this.tickStart}..${this.tickEnd}`, right - 120, height - 6);
    this.updateTooltip();
  }

  private drawDiamond(x: number, y: number, radius: number, color: string): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - radius);
    this.ctx.lineTo(x + radius, y);
    this.ctx.lineTo(x, y + radius);
    this.ctx.lineTo(x - radius, y);
    this.ctx.closePath();
    this.ctx.fillStyle = color;
    this.ctx.fill();
    this.ctx.strokeStyle = 'rgba(36, 32, 28, 0.35)';
    this.ctx.lineWidth = 0.7;
    this.ctx.stroke();
  }

  private updateTooltip(): void {
    if (this.selection.effectiveIndex === null) {
      this.tooltipElement.textContent = 'Hover or click markers for tick details.';
      return;
    }

    const summary = this.summaries[this.selection.effectiveIndex];
    if (!summary) {
      this.tooltipElement.textContent = 'Hover or click markers for tick details.';
      return;
    }

    const typeParts: string[] = [];
    for (const type of this.visibleTypes) {
      const count = summary.countsByType[type] ?? 0;
      typeParts.push(`${typeLabel(type)}:${count}`);
    }
    const rainLabel = this.isRainAtTick(summary.tick) ? 'rain:on' : 'rain:off';
    const pinLabel = this.selection.pinnedIndex !== null ? ' [pinned]' : '';
    const joined = [...typeParts, rainLabel].join('  ');
    this.tooltipElement.textContent = `tick ${summary.tick}${pinLabel} | ${joined}`;
  }

  private resizeForDisplay(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width * dpr));
    const height = Math.max(130, Math.floor(rect.height * dpr));
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;
  }

  private getNearestSummaryIndexAtCanvasX(xPx: number): number | null {
    if (this.summaries.length === 0 || this.summaryXs.length === 0) {
      return null;
    }
    if (this.summaryXs.length === 1) {
      return 0;
    }

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.summaryXs.length; i += 1) {
      const x = this.summaryXs[i];
      if (x === undefined) {
        continue;
      }
      const distance = Math.abs(xPx - x);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    return bestIndex;
  }

  private isRainAtTick(tick: number): boolean {
    for (const interval of this.rainIntervals) {
      if (tick >= interval.startTick && tick <= interval.endTick) {
        return true;
      }
    }
    return false;
  }
}
