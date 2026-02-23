import type { EventType, TickSummary } from '../ui/eventAnalytics';

export interface TimelineRenderConfig {
  splitByRank: boolean;
  selectedTypes: EventType[];
  selectedRankKeys: string[];
  showLegend: boolean;
}

const TYPE_COLORS: Record<EventType, string> = {
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
  private hoverIndex: number | null = null;

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
      const x = event.clientX - rect.left;
      const contentLeft = 32;
      const contentRight = this.canvas.width - 8;
      const contentWidth = Math.max(1, contentRight - contentLeft);
      if (this.summaries.length === 0 || x < contentLeft || x > contentRight) {
        this.hoverIndex = null;
        this.updateTooltip();
        return;
      }

      const barPitch = contentWidth / this.summaries.length;
      const index = Math.floor((x - contentLeft) / barPitch);
      if (index < 0 || index >= this.summaries.length) {
        this.hoverIndex = null;
        this.updateTooltip();
        return;
      }

      this.hoverIndex = index;
      this.updateTooltip();
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverIndex = null;
      this.updateTooltip();
    });
  }

  render(summaries: TickSummary[], config: TimelineRenderConfig): void {
    this.summaries = summaries;
    this.resizeForDisplay();

    const { width, height } = this.canvas;
    const top = 10;
    const bottom = height - 20;
    const left = 32;
    const right = width - 8;
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
    this.ctx.stroke();

    if (summaries.length === 0) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('No events for current filters', left + 6, top + 12);
      this.updateTooltip();
      return;
    }

    const stackedByIndex = summaries.map((summary) =>
      this.stackedEntries(summary, config.splitByRank, config.selectedTypes, config.selectedRankKeys),
    );
    const totals = stackedByIndex.map((entries) =>
      entries.reduce((sum, entry) => sum + entry.value, 0),
    );
    const maxTotal = Math.max(1, ...totals);
    const barPitch = contentWidth / summaries.length;
    const barWidth = Math.max(1, Math.floor(barPitch * 0.75));

    for (let i = 0; i < summaries.length; i += 1) {
      const entries = stackedByIndex[i] ?? [];
      if (entries.length === 0) {
        continue;
      }

      const x = left + i * barPitch + (barPitch - barWidth) / 2;
      let y = bottom;
      const total = totals[i] ?? 0;
      for (const entry of entries) {
        const ratio = total > 0 ? entry.value / maxTotal : 0;
        const h = ratio * contentHeight;
        y -= h;
        this.ctx.fillStyle = entry.color;
        this.ctx.fillRect(x, y, barWidth, h);
      }

      if (this.hoverIndex === i) {
        this.ctx.strokeStyle = '#2f2b24';
        this.ctx.lineWidth = 1.3;
        this.ctx.strokeRect(x - 1, y - 1, barWidth + 2, bottom - y + 2);
      }
    }

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    const firstTick = summaries[0]?.tick ?? 0;
    const lastTick = summaries[summaries.length - 1]?.tick ?? firstTick;
    this.ctx.fillText(`eventful ticks: ${summaries.length}`, left, height - 6);
    this.ctx.fillText(`ticks ${firstTick}..${lastTick}`, right - 110, height - 6);

    this.updateTooltip();
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
    if (this.hoverIndex === null) {
      this.tooltipElement.textContent = 'Hover bars for tick details.';
      return;
    }

    const summary = this.summaries[this.hoverIndex];
    if (!summary) {
      this.tooltipElement.textContent = 'Hover bars for tick details.';
      return;
    }

    const typeParts: string[] = [];
    for (const [type, count] of Object.entries(summary.countsByType)) {
      if (count > 0) {
        typeParts.push(`${type}:${count}`);
      }
    }
    this.tooltipElement.textContent = `tick ${summary.tick} | ${typeParts.join('  ') || 'no events'}`;
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
