import type { EventType, TickSummary } from '../ui/eventAnalytics';

export interface TimelineRenderConfig {
  splitByRank: boolean;
  selectedTypes: EventType[];
  selectedRankKeys: string[];
  showLegend: boolean;
  tickStart: number;
  tickEnd: number;
}

interface TimelineBin {
  tickStart: number;
  tickEnd: number;
  countsByType: Record<EventType, number>;
  byTypeByRankKey: Record<EventType, Record<string, number>>;
  total: number;
}

const CONTENT_LEFT = 38;
const CONTENT_RIGHT_PADDING = 12;

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

function emptyCountsByType(): Record<EventType, number> {
  return {
    touch: 0,
    handshake: 0,
    peaceCry: 0,
    stab: 0,
    death: 0,
    birth: 0,
    regularized: 0,
  };
}

function emptyByTypeByRank(): Record<EventType, Record<string, number>> {
  return {
    touch: {},
    handshake: {},
    peaceCry: {},
    stab: {},
    death: {},
    birth: {},
    regularized: {},
  };
}

export class EventTimelineRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private bins: TimelineBin[] = [];
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
      const contentLeft = CONTENT_LEFT;
      const contentRight = this.canvas.width - CONTENT_RIGHT_PADDING;
      const contentWidth = Math.max(1, contentRight - contentLeft);
      if (this.bins.length === 0 || x < contentLeft || x > contentRight) {
        this.hoverIndex = null;
        this.updateTooltip();
        return;
      }

      const barPitch = contentWidth / this.bins.length;
      const index = Math.floor((x - contentLeft) / barPitch);
      if (index < 0 || index >= this.bins.length) {
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
    this.resizeForDisplay();

    const { width, height } = this.canvas;
    const top = 10;
    const bottom = height - 20;
    const left = CONTENT_LEFT;
    const right = width - CONTENT_RIGHT_PADDING;
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

    const tickStart = Math.max(0, Math.floor(config.tickStart));
    const tickEnd = Math.max(tickStart, Math.floor(config.tickEnd));
    const bins = this.buildBins(
      summaries,
      config.splitByRank,
      config.selectedTypes,
      config.selectedRankKeys,
      contentWidth,
      tickStart,
      tickEnd,
    );
    this.bins = bins;

    const maxTotal = Math.max(1, ...bins.map((bin) => bin.total));
    const barPitch = contentWidth / bins.length;
    const barWidth = Math.max(1, Math.floor(barPitch));

    for (let i = 0; i < bins.length; i += 1) {
      const bin = bins[i];
      if (!bin) {
        continue;
      }
      const x = left + i * barPitch;

      // Draw slot background so empty bins remain visible and aligned with the full tick range.
      this.ctx.fillStyle = 'rgba(84, 74, 54, 0.06)';
      this.ctx.fillRect(x, top, barWidth, contentHeight);

      if (bin.total > 0) {
        let y = bottom;
        const entries = this.stackedEntriesFromBin(
          bin,
          config.splitByRank,
          config.selectedTypes,
          config.selectedRankKeys,
        );
        for (const entry of entries) {
          const ratio = entry.value / maxTotal;
          const h = ratio * contentHeight;
          y -= h;
          this.ctx.fillStyle = entry.color;
          this.ctx.fillRect(x, y, barWidth, h);
        }
      }

      if (this.hoverIndex === i) {
        this.ctx.strokeStyle = '#2f2b24';
        this.ctx.lineWidth = 1.2;
        this.ctx.strokeRect(x - 0.5, top - 0.5, barWidth + 1, contentHeight + 1);
      }
    }

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    const nonEmptyBins = bins.reduce((count, bin) => count + (bin.total > 0 ? 1 : 0), 0);
    this.ctx.fillText(`bins with events: ${nonEmptyBins}/${bins.length}`, left, height - 6);
    this.ctx.fillText(`ticks ${tickStart}..${tickEnd}`, right - 110, height - 6);

    if (summaries.length === 0) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('No events for current filters', left + 6, top + 12);
    }

    this.updateTooltip();
  }

  private buildBins(
    summaries: TickSummary[],
    splitByRank: boolean,
    selectedTypes: EventType[],
    selectedRankKeys: string[],
    contentWidth: number,
    tickStart: number,
    tickEnd: number,
  ): TimelineBin[] {
    const binCount = Math.max(1, Math.floor(contentWidth));
    const bins: TimelineBin[] = Array.from({ length: binCount }, (_, index) => {
      const start = Math.floor(tickStart + (index / binCount) * (tickEnd - tickStart + 1));
      const end =
        index === binCount - 1
          ? tickEnd
          : Math.floor(tickStart + ((index + 1) / binCount) * (tickEnd - tickStart + 1)) - 1;
      return {
        tickStart: start,
        tickEnd: Math.max(start, end),
        countsByType: emptyCountsByType(),
        byTypeByRankKey: emptyByTypeByRank(),
        total: 0,
      };
    });

    const tickSpan = Math.max(1, tickEnd - tickStart);
    for (const summary of summaries) {
      const normalized = (summary.tick - tickStart) / tickSpan;
      const clamped = Math.max(0, Math.min(1, normalized));
      const index = Math.min(binCount - 1, Math.floor(clamped * (binCount - 1)));
      const bin = bins[index];
      if (!bin) {
        continue;
      }

      const entries = this.stackedEntries(summary, splitByRank, selectedTypes, selectedRankKeys);
      const binTotal = entries.reduce((sum, entry) => sum + entry.value, 0);
      bin.total += binTotal;

      for (const eventType of selectedTypes) {
        const value = summary.countsByType[eventType] ?? 0;
        bin.countsByType[eventType] += value;
      }

      if (splitByRank) {
        for (const eventType of selectedTypes) {
          const byRank = summary.byTypeByRankKey[eventType];
          if (!byRank) {
            continue;
          }
          for (const [rankKey, value] of Object.entries(byRank)) {
            bin.byTypeByRankKey[eventType][rankKey] =
              (bin.byTypeByRankKey[eventType][rankKey] ?? 0) + value;
          }
        }
      }
    }

    return bins;
  }

  private stackedEntriesFromBin(
    bin: TimelineBin,
    splitByRank: boolean,
    selectedTypes: EventType[],
    selectedRankKeys: string[],
  ): Array<{ value: number; color: string }> {
    if (splitByRank) {
      const rankOrder = selectedRankKeys.length > 0 ? selectedRankKeys : this.rankKeysInBin(bin, selectedTypes);
      const entries: Array<{ value: number; color: string }> = [];
      for (const rankKey of rankOrder) {
        let value = 0;
        for (const eventType of selectedTypes) {
          value += bin.byTypeByRankKey[eventType]?.[rankKey] ?? 0;
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
      const value = bin.countsByType[eventType] ?? 0;
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

  private rankKeysInBin(bin: TimelineBin, selectedTypes: EventType[]): string[] {
    const keys = new Set<string>();
    for (const eventType of selectedTypes) {
      for (const rankKey of Object.keys(bin.byTypeByRankKey[eventType] ?? {})) {
        keys.add(rankKey);
      }
    }
    return [...keys].sort((a, b) => a.localeCompare(b));
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

    const bin = this.bins[this.hoverIndex];
    if (!bin) {
      this.tooltipElement.textContent = 'Hover bars for tick details.';
      return;
    }

    const typeParts: string[] = [];
    for (const [type, count] of Object.entries(bin.countsByType)) {
      if (count > 0) {
        typeParts.push(`${type}:${count}`);
      }
    }
    const tickLabel =
      bin.tickStart === bin.tickEnd ? `tick ${bin.tickStart}` : `ticks ${bin.tickStart}-${bin.tickEnd}`;
    this.tooltipElement.textContent = `${tickLabel} | ${typeParts.join('  ') || 'no events'}`;
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
