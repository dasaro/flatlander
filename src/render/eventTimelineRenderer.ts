import type { EventType, TickSummary } from '../ui/eventAnalytics';
import { getNearestEventfulIndexAtX, TimelineSelectionState } from '../ui/timelineSelectionState';

export interface TimelineRenderConfig {
  splitByRank: boolean;
  selectedTypes: EventType[];
  selectedRankKeys: string[];
  showLegend: boolean;
  tickStart: number;
  tickEnd: number;
}

const CONTENT_LEFT = 38;
const CONTENT_RIGHT_PADDING = 12;

const TYPE_COLORS: Record<EventType, string> = {
  handshakeStart: '#5f9aa2',
  touch: '#c99d4c',
  handshake: '#2b7760',
  peaceCry: '#3a678c',
  stab: '#b84040',
  death: '#2c2a24',
  birth: '#60845c',
  regularized: '#6c57a8',
};

function colorFromRankKey(rankKey: string): string {
  const hash = [...rankKey].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue} 48% 44%)`;
}

export class EventTimelineRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private summaries: TickSummary[] = [];
  private readonly selection = new TimelineSelectionState();

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
      const contentWidth = Math.max(1, contentRight - contentLeft);
      if (xPx < contentLeft || xPx > contentRight) {
        this.selection.setHovered(null);
      } else {
        this.selection.setHovered(
          getNearestEventfulIndexAtX(xPx - contentLeft, contentWidth, this.summaries.length),
        );
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
      const contentWidth = Math.max(1, contentRight - contentLeft);
      if (xPx < contentLeft || xPx > contentRight) {
        this.selection.clearPin();
      } else {
        this.selection.togglePinned(
          getNearestEventfulIndexAtX(xPx - contentLeft, contentWidth, this.summaries.length),
        );
      }
      this.updateTooltip();
    });
  }

  render(summaries: TickSummary[], config: TimelineRenderConfig): void {
    this.resizeForDisplay();
    this.summaries = summaries;
    if (this.selection.pinnedIndex !== null && (this.selection.pinnedIndex < 0 || this.selection.pinnedIndex >= summaries.length)) {
      this.selection.clearPin();
    }
    if (this.selection.hoveredIndex !== null && (this.selection.hoveredIndex < 0 || this.selection.hoveredIndex >= summaries.length)) {
      this.selection.setHovered(null);
    }

    const { width, height } = this.canvas;
    const top = 10;
    const bottom = height - 20;
    const baseY = bottom - 6;
    const left = CONTENT_LEFT;
    const right = width - CONTENT_RIGHT_PADDING;
    const contentWidth = Math.max(1, right - left);
    const contentHeight = Math.max(1, baseY - top);

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#fffdf8';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.strokeStyle = '#9e957f';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(left, baseY + 0.5);
    this.ctx.lineTo(right, baseY + 0.5);
    this.ctx.moveTo(left + 0.5, top);
    this.ctx.lineTo(left + 0.5, baseY);
    this.ctx.stroke();

    if (summaries.length === 0) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('No events for current filters', left + 6, top + 12);
      this.ctx.fillStyle = '#2b2721';
      this.ctx.font = '11px Trebuchet MS, sans-serif';
      this.ctx.fillText('eventful slices: 0', left, height - 6);
      this.ctx.fillText(`ticks ${config.tickStart}..${config.tickEnd}`, right - 110, height - 6);
      this.updateTooltip();
      return;
    }

    const entriesBySummary = summaries.map((summary) =>
      this.stackedEntries(summary, config.splitByRank, config.selectedTypes, config.selectedRankKeys),
    );
    const maxTotal = Math.max(
      1,
      ...entriesBySummary.map((entries) => entries.reduce((sum, entry) => sum + entry.value, 0)),
    );
    const maxDepth = Math.max(1, ...entriesBySummary.map((entries) => entries.length));
    const pitch = summaries.length <= 1 ? contentWidth : contentWidth / (summaries.length - 1);
    const laneGap = Math.max(10, Math.min(22, contentHeight / (maxDepth + 1)));
    const maxDiamondRadius = Math.max(3, Math.min(8, Math.max(2, pitch) * 0.35));

    for (let i = 0; i < summaries.length; i += 1) {
      const xCenter = summaries.length <= 1 ? left + contentWidth / 2 : left + i * pitch;
      const entries = entriesBySummary[i] ?? [];

      for (let layer = 0; layer < entries.length; layer += 1) {
        const entry = entries[layer];
        if (!entry) {
          continue;
        }
        const yCenter = baseY - (layer + 1) * laneGap;
        const valueRatio = Math.max(0, Math.min(1, entry.value / maxTotal));
        const radius = Math.max(2.5, maxDiamondRadius * (0.45 + 0.55 * Math.sqrt(valueRatio)));
        this.drawDiamond(xCenter, yCenter, radius, entry.color, true);
      }

      if (this.selection.effectiveIndex === i) {
        const highlightWidth = Math.max(4, pitch * 0.7);
        this.ctx.strokeStyle = this.selection.pinnedIndex === i ? '#1e1b16' : '#3b352c';
        this.ctx.lineWidth = this.selection.pinnedIndex === i ? 1.6 : 1;
        this.ctx.strokeRect(xCenter - highlightWidth * 0.5, top, highlightWidth, contentHeight + 6);
      }
    }

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    this.ctx.fillText(`eventful slices: ${summaries.length}`, left, height - 6);
    this.ctx.fillText(`ticks ${config.tickStart}..${config.tickEnd}`, right - 110, height - 6);

    this.updateTooltip();
  }

  private drawDiamond(
    x: number,
    y: number,
    radius: number,
    color: string,
    filled: boolean,
  ): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - radius);
    this.ctx.lineTo(x + radius, y);
    this.ctx.lineTo(x, y + radius);
    this.ctx.lineTo(x - radius, y);
    this.ctx.closePath();
    if (filled) {
      this.ctx.fillStyle = color;
      this.ctx.fill();
      this.ctx.strokeStyle = 'rgba(36, 32, 28, 0.35)';
      this.ctx.lineWidth = 0.7;
      this.ctx.stroke();
      return;
    }
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 1;
    this.ctx.stroke();
  }

  private stackedEntries(
    summary: TickSummary,
    splitByRank: boolean,
    selectedTypes: EventType[],
    selectedRankKeys: string[],
  ): Array<{ value: number; color: string }> {
    if (splitByRank) {
      const rankKeys = selectedRankKeys.length > 0 ? selectedRankKeys : Object.keys(summary.countsByRankKey);
      const entries: Array<{ value: number; color: string }> = [];
      for (const rankKey of rankKeys) {
        let value = 0;
        for (const eventType of selectedTypes) {
          value += summary.byTypeByRankKey[eventType]?.[rankKey] ?? 0;
        }
        if (value <= 0) {
          continue;
        }
        entries.push({
          value,
          color: colorFromRankKey(rankKey),
        });
      }
      return entries;
    }

    const entries: Array<{ value: number; color: string }> = [];
    for (const eventType of selectedTypes) {
      const value = summary.countsByType[eventType] ?? 0;
      if (value <= 0) {
        continue;
      }
      entries.push({
        value,
        color: TYPE_COLORS[eventType],
      });
    }
    return entries;
  }

  private updateTooltip(): void {
    if (this.selection.effectiveIndex === null) {
      this.tooltipElement.textContent = 'Hover or click diamonds for tick details.';
      return;
    }

    const summary = this.summaries[this.selection.effectiveIndex];
    if (!summary) {
      this.tooltipElement.textContent = 'Hover or click diamonds for tick details.';
      return;
    }

    const typeParts: string[] = [];
    for (const [type, count] of Object.entries(summary.countsByType)) {
      if (count > 0) {
        typeParts.push(`${type}:${count}`);
      }
    }
    const pinLabel = this.selection.pinnedIndex !== null ? ' [pinned]' : '';
    this.tooltipElement.textContent = `tick ${summary.tick}${pinLabel} | ${typeParts.join('  ') || 'no events'}`;
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
}
