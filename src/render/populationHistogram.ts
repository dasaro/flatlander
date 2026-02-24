import type { World } from '../core/world';
import { rankKeyForEntity } from '../core/rankKey';
import { PopulationHistoryStore } from '../ui/populationHistoryStore';

interface PopulationSample {
  tick: number;
  population: number;
  groups: number[];
}

const MIN_CANVAS_WIDTH = 320;
const MIN_CANVAS_HEIGHT = 120;
const MAX_GROUPS = 9;
const CONTENT_LEFT = 38;
const CONTENT_RIGHT_PADDING = 12;
const CONTENT_TOP = 12;
const CONTENT_BOTTOM_PADDING = 34;

interface CompositionGroup {
  label: string;
  color: string;
}

const COMPOSITION_GROUPS: CompositionGroup[] = [
  { label: 'Women', color: '#6b8db7' },
  { label: 'Iso', color: '#b25252' },
  { label: 'Eq', color: '#4a9b84' },
  { label: 'Gent', color: '#7d67b7' },
  { label: 'Noble', color: '#9d5757' },
  { label: 'Near', color: '#365d95' },
  { label: 'Priest', color: '#d2ac3f' },
  { label: 'Irreg', color: '#5f5348' },
  { label: 'Other', color: '#8a8a8a' },
];

export function resamplePopulationSamples(
  samples: ReadonlyArray<PopulationSample>,
  columns: number,
  groupCount = MAX_GROUPS,
): PopulationSample[] {
  if (samples.length === 0 || columns <= 0) {
    return [];
  }

  const normalizedColumns = Math.max(1, Math.floor(columns));
  if (samples.length === 1 || normalizedColumns === 1) {
    const sample = samples[0];
    if (!sample) {
      return [];
    }
    return [
      {
        tick: sample.tick,
        population: sample.population,
        groups: sample.groups.slice(0, groupCount),
      },
    ];
  }

  const lastIndex = samples.length - 1;
  const firstTick = samples[0]?.tick ?? 0;
  const lastTick = samples[lastIndex]?.tick ?? firstTick;
  const tickSpan = Math.max(1, lastTick - firstTick);
  const out: PopulationSample[] = [];

  for (let i = 0; i < normalizedColumns; i += 1) {
    const samplePos = (i / (normalizedColumns - 1)) * lastIndex;
    const lo = Math.floor(samplePos);
    const hi = Math.min(lastIndex, lo + 1);
    const alpha = samplePos - lo;
    const loSample = samples[lo];
    const hiSample = samples[hi];
    if (!loSample || !hiSample) {
      continue;
    }

    const groups = new Array<number>(groupCount).fill(0);
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
      const loGroup = loSample.groups[groupIndex] ?? 0;
      const hiGroup = hiSample.groups[groupIndex] ?? 0;
      groups[groupIndex] = loGroup + (hiGroup - loGroup) * alpha;
    }

    const tick = Math.round(firstTick + (i / (normalizedColumns - 1)) * tickSpan);
    const population = loSample.population + (hiSample.population - loSample.population) * alpha;
    out.push({ tick, population, groups });
  }

  return out;
}

export class PopulationHistogram {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly history = new PopulationHistoryStore();
  private dirty = true;
  private hoveredSliceIndex: number | null = null;
  private pinnedSliceIndex: number | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly tooltipElement?: HTMLElement,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Population histogram canvas context unavailable.');
    }
    this.ctx = ctx;

    this.canvas.addEventListener('mousemove', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const chartWidth = Math.max(1, this.canvas.width - CONTENT_LEFT - CONTENT_RIGHT_PADDING);
      const xInChart = x * (this.canvas.width / Math.max(1, rect.width)) - CONTENT_LEFT;
      if (xInChart < 0 || xInChart > chartWidth) {
        this.hoveredSliceIndex = null;
      } else {
        this.hoveredSliceIndex = this.history.getNearestSliceIndexAtCanvasX(xInChart, chartWidth);
      }
      this.updateTooltip();
      this.dirty = true;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoveredSliceIndex = null;
      this.updateTooltip();
      this.dirty = true;
    });

    this.canvas.addEventListener('click', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const chartWidth = Math.max(1, this.canvas.width - CONTENT_LEFT - CONTENT_RIGHT_PADDING);
      const xInChart = x * (this.canvas.width / Math.max(1, rect.width)) - CONTENT_LEFT;
      if (xInChart < 0 || xInChart > chartWidth) {
        this.pinnedSliceIndex = null;
      } else {
        const picked = this.history.getNearestSliceIndexAtCanvasX(xInChart, chartWidth);
        this.pinnedSliceIndex = this.pinnedSliceIndex === picked ? null : picked;
      }
      this.updateTooltip();
      this.dirty = true;
    });
  }

  clearSelection(): void {
    this.pinnedSliceIndex = null;
    this.hoveredSliceIndex = null;
    this.updateTooltip();
    this.dirty = true;
  }

  reset(world: World): void {
    this.history.reset(world.tick);
    this.pinnedSliceIndex = null;
    this.hoveredSliceIndex = null;
    this.dirty = true;
    this.updateTooltip();
  }

  record(world: World): void {
    const countsByRank: Record<string, number> = {};
    for (const entityId of world.entities) {
      const key = rankKeyForEntity(world, entityId);
      countsByRank[key] = (countsByRank[key] ?? 0) + 1;
    }
    this.history.ingest(world.tick, countsByRank);
    this.dirty = true;
  }

  render(): void {
    const resized = this.resizeForDisplay();
    if (!this.dirty && !resized) {
      return;
    }

    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#fffdf8';
    this.ctx.fillRect(0, 0, width, height);

    const left = CONTENT_LEFT;
    const right = width - CONTENT_RIGHT_PADDING;
    const top = CONTENT_TOP;
    const bottom = height - CONTENT_BOTTOM_PADDING;
    const chartHeight = Math.max(1, bottom - top);
    const chartWidth = Math.max(1, right - left);

    this.ctx.strokeStyle = 'rgba(70, 62, 46, 0.35)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(left, bottom + 0.5);
    this.ctx.lineTo(right, bottom + 0.5);
    this.ctx.moveTo(left + 0.5, top);
    this.ctx.lineTo(left + 0.5, bottom);
    this.ctx.stroke();

    const allSlices = this.history.slices;
    const samples = this.toSamples(allSlices);

    if (samples.length < 2) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('No tick history yet', left + 8, top + 14);
      this.dirty = false;
      this.updateTooltip();
      return;
    }

    const sampled = resamplePopulationSamples(samples, Math.floor(chartWidth), MAX_GROUPS);
    const latest = samples[samples.length - 1];
    if (!latest || sampled.length < 2) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('No tick history yet', left + 8, top + 14);
      this.dirty = false;
      this.updateTooltip();
      return;
    }

    const maxPopulation = Math.max(1, ...sampled.map((point) => point.population));
    this.drawPopulationScaleGrid(left, right, top, bottom, maxPopulation);
    const envelopeHeights = sampled.map((point) =>
      point.population > 0 ? (point.population / maxPopulation) * chartHeight : 0,
    );

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(left, top, chartWidth, bottom - top);
    this.ctx.clip();

    const count = sampled.length;
    const xs =
      count <= 1
        ? [left]
        : Array.from({ length: count }, (_, i) => left + (i / (count - 1)) * chartWidth);
    const cumulativeY: number[][] = Array.from({ length: COMPOSITION_GROUPS.length + 1 }, () =>
      new Array<number>(count).fill(bottom),
    );

    for (let i = 0; i < count; i += 1) {
      const point = sampled[i];
      const envelopeHeight = envelopeHeights[i] ?? 0;
      cumulativeY[0]![i] = bottom;
      if (!point || point.population <= 0 || envelopeHeight <= 0) {
        for (let groupIndex = 0; groupIndex < COMPOSITION_GROUPS.length; groupIndex += 1) {
          cumulativeY[groupIndex + 1]![i] = bottom;
        }
        continue;
      }

      let cumulativeHeight = 0;
      for (let groupIndex = 0; groupIndex < COMPOSITION_GROUPS.length; groupIndex += 1) {
        const groupPopulation = point.groups[groupIndex] ?? 0;
        const fraction = point.population > 0 ? groupPopulation / point.population : 0;
        const bandHeight = Math.max(0, fraction * envelopeHeight);
        cumulativeHeight += bandHeight;
        cumulativeY[groupIndex + 1]![i] = bottom - cumulativeHeight;
      }
    }

    for (let groupIndex = 0; groupIndex < COMPOSITION_GROUPS.length; groupIndex += 1) {
      const lower = cumulativeY[groupIndex];
      const upper = cumulativeY[groupIndex + 1];
      if (!lower || !upper || lower.length === 0 || upper.length === 0) {
        continue;
      }

      const forward = xs.map((x, i) => ({ x, y: lower[i] ?? bottom }));
      const backward = xs
        .map((x, i) => ({ x, y: upper[i] ?? bottom }))
        .reverse();

      this.ctx.beginPath();
      this.tracePolyline(forward, false);
      this.tracePolyline(backward, true);
      this.ctx.closePath();
      this.ctx.fillStyle = COMPOSITION_GROUPS[groupIndex]?.color ?? '#888888';
      this.ctx.fill();
    }

    this.ctx.restore();

    const effectiveIndex = this.pinnedSliceIndex ?? this.hoveredSliceIndex;
    if (effectiveIndex !== null && allSlices.length > 0) {
      const normalized = allSlices.length <= 1 ? 0 : effectiveIndex / (allSlices.length - 1);
      const x = left + normalized * chartWidth;
      this.ctx.save();
      this.ctx.strokeStyle = this.pinnedSliceIndex !== null ? 'rgba(33, 30, 25, 0.85)' : 'rgba(33, 30, 25, 0.55)';
      this.ctx.lineWidth = this.pinnedSliceIndex !== null ? 2 : 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x + 0.5, top);
      this.ctx.lineTo(x + 0.5, bottom);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    const peakPopulation = samples.reduce((max, sample) => Math.max(max, sample.population), latest.population);
    this.ctx.fillText(`Pop ${latest.population}`, right - 74, top + 10);
    this.ctx.fillText(`Peak ${peakPopulation}`, right - 74, top + 22);
    const ticksLabel = `Tick 0..${latest.tick}`;
    const ticksWidth = this.ctx.measureText(ticksLabel).width;
    this.ctx.fillText(ticksLabel, right - ticksWidth, height - 8);

    this.drawLegend(left, height - 20, right);
    this.dirty = false;
    this.updateTooltip();
  }

  private toSamples(slices: ReadonlyArray<{ tick: number; countsByRankKey: Record<string, number>; total: number }>): PopulationSample[] {
    return slices.map((slice) => {
      const groups = new Array<number>(MAX_GROUPS).fill(0);
      for (const [rankKey, value] of Object.entries(slice.countsByRankKey)) {
        const groupIndex = this.compositionGroupIndexFromRankKey(rankKey);
        groups[groupIndex] = (groups[groupIndex] ?? 0) + value;
      }
      return {
        tick: slice.tick,
        population: slice.total,
        groups,
      };
    });
  }

  private updateTooltip(): void {
    if (!this.tooltipElement) {
      return;
    }

    const slices = this.history.slices;
    const effectiveIndex = this.pinnedSliceIndex ?? this.hoveredSliceIndex;
    if (effectiveIndex === null || slices.length === 0) {
      this.tooltipElement.textContent = 'Hover the chart to inspect a slice. Click to pin.';
      return;
    }

    const slice = slices[Math.max(0, Math.min(slices.length - 1, effectiveIndex))];
    if (!slice) {
      this.tooltipElement.textContent = 'Hover the chart to inspect a slice. Click to pin.';
      return;
    }

    const samples = this.toSamples([slice]);
    const sample = samples[0];
    if (!sample) {
      this.tooltipElement.textContent = 'Hover the chart to inspect a slice. Click to pin.';
      return;
    }

    const parts: string[] = [];
    for (let i = 0; i < COMPOSITION_GROUPS.length; i += 1) {
      const count = Math.round(sample.groups[i] ?? 0);
      if (count <= 0) {
        continue;
      }
      parts.push(`${COMPOSITION_GROUPS[i]?.label ?? `g${i}`}:${count}`);
    }

    const pinLabel = this.pinnedSliceIndex !== null ? ' [pinned]' : '';
    this.tooltipElement.textContent = `tick ${slice.tick}${pinLabel} | total ${slice.total} | ${parts.join('  ') || 'no population'}`;
  }

  private tracePolyline(points: Array<{ x: number; y: number }>, lineToStart: boolean): void {
    if (points.length === 0) {
      return;
    }

    const first = points[0];
    if (!first) {
      return;
    }

    if (lineToStart) {
      this.ctx.lineTo(first.x, first.y);
    } else {
      this.ctx.moveTo(first.x, first.y);
    }

    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (!point) {
        continue;
      }
      this.ctx.lineTo(point.x, point.y);
    }
  }

  private drawPopulationScaleGrid(
    left: number,
    right: number,
    top: number,
    bottom: number,
    maxPopulation: number,
  ): void {
    const markers = [0, 25, 50, 75, 100];
    this.ctx.save();
    this.ctx.font = '10px Trebuchet MS, sans-serif';
    for (const marker of markers) {
      const ratio = marker / 100;
      const y = bottom - ratio * (bottom - top);
      this.ctx.strokeStyle = marker === 0 || marker === 100 ? 'rgba(70, 62, 46, 0.35)' : 'rgba(70, 62, 46, 0.17)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(left, y + 0.5);
      this.ctx.lineTo(right, y + 0.5);
      this.ctx.stroke();
      this.ctx.fillStyle = 'rgba(64, 57, 47, 0.72)';
      const count = Math.round((marker / 100) * maxPopulation);
      this.ctx.fillText(`${count}`, 4, y + 3);
    }
    this.ctx.restore();
  }

  private compositionGroupIndexFromRankKey(rankKey: string): number {
    if (rankKey.startsWith('Woman:')) {
      return 0;
    }
    if (rankKey === 'Triangle:Isosceles') {
      return 1;
    }
    if (rankKey === 'Triangle:Equilateral') {
      return 2;
    }
    if (rankKey === 'Gentleman') {
      return 3;
    }
    if (rankKey === 'Noble') {
      return 4;
    }
    if (rankKey === 'NearCircle') {
      return 5;
    }
    if (rankKey === 'Priest') {
      return 6;
    }
    if (rankKey === 'Irregular') {
      return 7;
    }
    return 8;
  }

  private drawLegend(startX: number, y: number, right: number): void {
    let x = startX;
    const rowHeight = 12;
    let row = 0;
    this.ctx.font = '10px Trebuchet MS, sans-serif';
    for (const group of COMPOSITION_GROUPS) {
      const labelWidth = this.ctx.measureText(group.label).width;
      const itemWidth = labelWidth + 24;
      if (x + itemWidth > right && row === 0) {
        row = 1;
        x = startX;
      }
      this.ctx.fillStyle = group.color;
      this.ctx.fillRect(x, y + row * rowHeight, 8, 6);
      this.ctx.fillStyle = '#2b2721';
      this.ctx.fillText(group.label, x + 12, y + 6 + row * rowHeight);
      x += itemWidth;
    }
  }

  private resizeForDisplay(): boolean {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(MIN_CANVAS_WIDTH, Math.floor(rect.width * dpr));
    const height = Math.max(MIN_CANVAS_HEIGHT, Math.floor(rect.height * dpr));

    if (this.canvas.width === width && this.canvas.height === height) {
      return false;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }
}
