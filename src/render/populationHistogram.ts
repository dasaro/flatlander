import type { World } from '../core/world';
import { rankKeyForEntity } from '../core/rankKey';

interface PopulationSample {
  tick: number;
  population: number;
  groups: number[];
}

const MIN_CANVAS_WIDTH = 320;
const MIN_CANVAS_HEIGHT = 120;
const MAX_GROUPS = 9;

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

export class PopulationHistogram {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly samples: PopulationSample[] = [];
  private lastTick = -1;
  private dirty = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Population histogram canvas context unavailable.');
    }
    this.ctx = ctx;
  }

  reset(world: World): void {
    this.samples.length = 0;
    this.lastTick = world.tick;
    this.samples.push(this.snapshot(world));
    this.dirty = true;
  }

  record(world: World): void {
    if (this.lastTick < 0) {
      this.reset(world);
      return;
    }

    if (world.tick === this.lastTick) {
      return;
    }

    this.samples.push(this.snapshot(world));
    this.lastTick = world.tick;
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

    const left = 38;
    const right = width - 12;
    const top = 12;
    const bottom = height - 34;
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

    if (this.samples.length === 0) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('No tick history yet', left + 8, top + 14);
      this.dirty = false;
      return;
    }

    const firstTick = this.samples[0]?.tick ?? 0;
    const latest = this.samples[this.samples.length - 1];
    const lastTick = latest?.tick ?? firstTick;
    const tickSpan = Math.max(1, lastTick - firstTick);
    const bins = this.buildBins(chartWidth, firstTick, tickSpan);
    const maxPopulation = Math.max(
      1,
      ...bins.map((bin) => (bin.count > 0 ? bin.population / bin.count : 0)),
    );
    this.drawPopulationScaleGrid(left, right, top, bottom, maxPopulation);
    const envelopeHeights = bins.map((bin) => {
      if (!bin || bin.count <= 0 || bin.population <= 0) {
        return 0;
      }
      const avgPopulation = bin.population / bin.count;
      return (avgPopulation / maxPopulation) * chartHeight;
    });

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(left, top, chartWidth, bottom - top);
    this.ctx.clip();

    const count = bins.length;
    const xs =
      count <= 1
        ? [left]
        : Array.from({ length: count }, (_, i) => left + (i / (count - 1)) * chartWidth);
    const cumulativeY: number[][] = Array.from({ length: COMPOSITION_GROUPS.length + 1 }, () =>
      new Array<number>(count).fill(bottom),
    );

    for (let i = 0; i < count; i += 1) {
      const bin = bins[i];
      const envelopeHeight = envelopeHeights[i] ?? 0;
      cumulativeY[0]![i] = bottom;
      if (!bin || bin.count <= 0 || bin.population <= 0 || envelopeHeight <= 0) {
        for (let groupIndex = 0; groupIndex < COMPOSITION_GROUPS.length; groupIndex += 1) {
          cumulativeY[groupIndex + 1]![i] = bottom;
        }
        continue;
      }

      const avgPopulation = bin.population / bin.count;
      let cumulativeHeight = 0;
      for (let groupIndex = 0; groupIndex < COMPOSITION_GROUPS.length; groupIndex += 1) {
        const avgGroupPopulation = (bin.groups[groupIndex] ?? 0) / bin.count;
        const fraction = avgPopulation > 0 ? avgGroupPopulation / avgPopulation : 0;
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
      this.traceCardinal(forward, false);
      this.traceCardinal(backward, true);
      this.ctx.closePath();
      this.ctx.fillStyle = COMPOSITION_GROUPS[groupIndex]?.color ?? '#888888';
      this.ctx.fill();
    }

    this.ctx.restore();

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    if (latest) {
      const peakPopulation = this.samples.reduce(
        (max, sample) => Math.max(max, sample.population),
        latest.population,
      );
      this.ctx.fillText(`Pop ${latest.population}`, right - 74, top + 10);
      this.ctx.fillText(`Peak ${peakPopulation}`, right - 74, top + 22);
      const ticksLabel = `Tick 0..${lastTick}`;
      const ticksWidth = this.ctx.measureText(ticksLabel).width;
      this.ctx.fillText(ticksLabel, right - ticksWidth, height - 8);
    }

    this.drawLegend(left, height - 20, right);
    this.dirty = false;
  }

  private traceCardinal(points: Array<{ x: number; y: number }>, lineToStart: boolean): void {
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

    if (points.length === 1) {
      return;
    }

    const tension = 1;
    const fallback = first;
    for (let i = 0; i < points.length - 1; i += 1) {
      const p0 = points[Math.max(0, i - 1)] ?? fallback;
      const p1 = points[i] ?? fallback;
      const p2 = points[i + 1] ?? fallback;
      const p3 = points[Math.min(points.length - 1, i + 2)] ?? fallback;

      const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
      const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
      const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
      const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;
      this.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
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

  private snapshot(world: World): PopulationSample {
    const groups = new Array<number>(MAX_GROUPS).fill(0);
    for (const entityId of world.entities) {
      const groupIndex = this.compositionGroupIndex(world, entityId);
      groups[groupIndex] = (groups[groupIndex] ?? 0) + 1;
    }

    return {
      tick: world.tick,
      population: world.entities.size,
      groups,
    };
  }

  private compositionGroupIndex(world: World, entityId: number): number {
    const rankKey = rankKeyForEntity(world, entityId);
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

  private buildBins(
    chartWidth: number,
    firstTick: number,
    tickSpan: number,
  ): Array<{ count: number; population: number; groups: number[] }> {
    const maxColumnsFromTicks = Math.max(1, Math.floor(tickSpan) + 1);
    const columns = Math.max(1, Math.min(Math.floor(chartWidth), 420, maxColumnsFromTicks));
    const bins = Array.from({ length: columns }, () => ({
      count: 0,
      population: 0,
      groups: new Array<number>(MAX_GROUPS).fill(0),
    }));

    for (const sample of this.samples) {
      const normalized = (sample.tick - firstTick) / tickSpan;
      const clamped = Math.max(0, Math.min(1, normalized));
      const index = Math.min(columns - 1, Math.floor(clamped * (columns - 1)));
      const bin = bins[index];
      if (!bin) {
        continue;
      }
      bin.count += 1;
      bin.population += sample.population;
      for (let groupIndex = 0; groupIndex < MAX_GROUPS; groupIndex += 1) {
        const groupTotal = bin.groups[groupIndex] ?? 0;
        bin.groups[groupIndex] = groupTotal + (sample.groups[groupIndex] ?? 0);
      }
    }

    return bins;
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
