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
    const barWidth = Math.max(1, Math.floor(chartWidth / bins.length));
    this.drawPopulationScaleGrid(left, right, top, bottom, maxPopulation);

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(left, top, chartWidth, bottom - top);
    this.ctx.clip();

    for (let i = 0; i < bins.length; i += 1) {
      const bin = bins[i];
      if (!bin || bin.count <= 0 || bin.population <= 0) {
        continue;
      }

      const x = left + i;
      let y = bottom;
      const avgPopulation = bin.population / bin.count;
      if (avgPopulation <= 0) {
        continue;
      }
      const envelopeHeight = (avgPopulation / maxPopulation) * chartHeight;
      if (envelopeHeight <= 0) {
        continue;
      }
      for (let groupIndex = 0; groupIndex < COMPOSITION_GROUPS.length; groupIndex += 1) {
        const avgGroupPopulation = (bin.groups[groupIndex] ?? 0) / bin.count;
        if (avgGroupPopulation <= 0) {
          continue;
        }
        const fraction = avgGroupPopulation / avgPopulation;
        if (fraction <= 0) {
          continue;
        }
        const h = fraction * envelopeHeight;
        y -= h;
        this.ctx.fillStyle = COMPOSITION_GROUPS[groupIndex]?.color ?? '#888888';
        this.ctx.fillRect(x, y, barWidth, h + 0.5);
      }
    }

    this.ctx.restore();

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    if (latest) {
      this.ctx.fillText(`Tick 0..${lastTick}`, left, height - 8);
      const peakPopulation = this.samples.reduce(
        (max, sample) => Math.max(max, sample.population),
        latest.population,
      );
      this.ctx.fillText(`Pop ${latest.population}`, right - 74, top + 10);
      this.ctx.fillText(`Peak ${peakPopulation}`, right - 74, top + 22);
    }

    this.drawLegend(left, height - 20, right);
    this.dirty = false;
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
    const columns = Math.max(1, Math.floor(chartWidth));
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
