import type { World } from '../core/world';

interface PopulationSample {
  tick: number;
  population: number;
  kills: number;
  newInhabitants: number;
}

const MIN_CANVAS_WIDTH = 320;
const MIN_CANVAS_HEIGHT = 120;

export class PopulationHistogram {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly samples: PopulationSample[] = [];
  private lastTick = -1;
  private lastPopulation = 0;

  constructor(private readonly canvas: HTMLCanvasElement, private readonly maxSamples = 180) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Population histogram canvas context unavailable.');
    }
    this.ctx = ctx;
  }

  reset(world: World): void {
    this.samples.length = 0;
    this.lastTick = world.tick;
    this.lastPopulation = world.entities.size;
  }

  record(world: World): void {
    if (this.lastTick < 0) {
      this.reset(world);
      return;
    }

    if (world.tick === this.lastTick) {
      return;
    }

    const deltaPopulation = world.entities.size - this.lastPopulation;
    const newInhabitants = Math.max(0, deltaPopulation + world.deathsThisTick);
    this.samples.push({
      tick: world.tick,
      population: world.entities.size,
      kills: Math.max(0, world.deathsThisTick),
      newInhabitants,
    });

    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples);
    }

    this.lastTick = world.tick;
    this.lastPopulation = world.entities.size;
  }

  render(): void {
    this.resizeForDisplay();

    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#fffdf8';
    this.ctx.fillRect(0, 0, width, height);

    const left = 34;
    const right = width - 12;
    const top = 12;
    const bottom = height - 20;
    const baseline = Math.round((top + bottom) / 2);
    const barUpMax = baseline - top - 6;
    const barDownMax = bottom - baseline - 6;

    this.ctx.strokeStyle = 'rgba(70, 62, 46, 0.35)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(left, baseline + 0.5);
    this.ctx.lineTo(right, baseline + 0.5);
    this.ctx.stroke();

    if (this.samples.length === 0) {
      this.ctx.fillStyle = '#736a5b';
      this.ctx.font = '12px Trebuchet MS, sans-serif';
      this.ctx.fillText('No tick history yet', left + 8, baseline - 6);
      return;
    }

    const maxNew = Math.max(1, ...this.samples.map((sample) => sample.newInhabitants));
    const maxKills = Math.max(1, ...this.samples.map((sample) => sample.kills));
    const maxPopulation = Math.max(1, ...this.samples.map((sample) => sample.population));

    const chartWidth = Math.max(1, right - left);
    const barPitch = chartWidth / this.samples.length;
    const barWidth = Math.max(1, Math.floor(barPitch * 0.75));

    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.rect(left, top, chartWidth, bottom - top);
    this.ctx.clip();

    for (let i = 0; i < this.samples.length; i += 1) {
      const sample = this.samples[i];
      if (!sample) {
        continue;
      }

      const x = left + i * barPitch + (barPitch - barWidth) / 2;

      if (sample.newInhabitants > 0) {
        const h = (sample.newInhabitants / maxNew) * barUpMax;
        this.ctx.fillStyle = 'rgba(49, 129, 96, 0.8)';
        this.ctx.fillRect(x, baseline - h, barWidth, h);
      }

      if (sample.kills > 0) {
        const h = (sample.kills / maxKills) * barDownMax;
        this.ctx.fillStyle = 'rgba(163, 70, 63, 0.82)';
        this.ctx.fillRect(x, baseline, barWidth, h);
      }
    }

    this.ctx.strokeStyle = '#2f5d8f';
    this.ctx.lineWidth = 1.6;
    this.ctx.beginPath();
    for (let i = 0; i < this.samples.length; i += 1) {
      const sample = this.samples[i];
      if (!sample) {
        continue;
      }

      const x = left + i * barPitch + barPitch / 2;
      const y = bottom - (sample.population / maxPopulation) * (bottom - top - 4);
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();

    this.ctx.restore();

    this.ctx.fillStyle = '#2b2721';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    const latest = this.samples[this.samples.length - 1];
    if (latest) {
      this.ctx.fillText(`Tick ${latest.tick}`, left, height - 6);
      this.ctx.fillText(`Pop ${latest.population}`, right - 70, top + 10);
    }

    this.ctx.fillStyle = 'rgba(49, 129, 96, 0.95)';
    this.ctx.fillRect(right - 170, height - 14, 10, 6);
    this.ctx.fillStyle = '#2b2721';
    this.ctx.fillText('new', right - 156, height - 8);

    this.ctx.fillStyle = 'rgba(163, 70, 63, 0.95)';
    this.ctx.fillRect(right - 115, height - 14, 10, 6);
    this.ctx.fillStyle = '#2b2721';
    this.ctx.fillText('kills', right - 101, height - 8);
  }

  private resizeForDisplay(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(MIN_CANVAS_WIDTH, Math.floor(rect.width * dpr));
    const height = Math.max(MIN_CANVAS_HEIGHT, Math.floor(rect.height * dpr));

    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
  }
}
