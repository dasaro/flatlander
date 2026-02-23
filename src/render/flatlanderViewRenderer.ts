import type { FlatlanderScanResult, FlatlanderViewConfig } from './flatlanderScan';

function tintFromHitId(hitId: number, alpha: number): string {
  const hue = ((hitId * 53) % 360 + 360) % 360;
  return `hsla(${hue}, 56%, 42%, ${alpha.toFixed(3)})`;
}

function scaleCanvasToDisplay(canvas: HTMLCanvasElement): { width: number; height: number } {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }

  return { width, height };
}

export class FlatlanderViewRenderer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Flatlander canvas 2D context unavailable.');
    }
    this.ctx = context;
  }

  clearWithMessage(message: string): void {
    const { width, height } = scaleCanvasToDisplay(this.canvas);
    const dpr = this.canvas.width / width;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#fffdf8';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.strokeStyle = 'rgba(78, 72, 61, 0.18)';
    this.ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    this.ctx.fillStyle = '#6e6555';
    this.ctx.font = '13px Trebuchet MS, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(message, width / 2, height / 2);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  render(result: FlatlanderScanResult, cfg: FlatlanderViewConfig, viewerHeadingRad: number): void {
    const { width, height } = scaleCanvasToDisplay(this.canvas);
    const dpr = this.canvas.width / width;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#fffdf8';
    this.ctx.fillRect(0, 0, width, height);

    const baselineY = Math.round(height * 0.58);
    this.ctx.strokeStyle = 'rgba(70, 65, 58, 0.28)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, baselineY + 0.5);
    this.ctx.lineTo(width, baselineY + 0.5);
    this.ctx.stroke();

    const samples = result.samples;
    const count = samples.length;
    if (count <= 0) {
      this.clearWithMessage('No samples.');
      return;
    }

    for (let i = 0; i < count; i += 1) {
      const sample = samples[i];
      if (!sample || sample.hitId === null || sample.intensity <= 0) {
        continue;
      }

      const x = count <= 1 ? width / 2 : (i / (count - 1)) * width;
      const alpha = Math.max(0.05, Math.min(1, sample.intensity));
      const halfHeight = 2 + sample.intensity * 10;

      this.ctx.strokeStyle = cfg.grayscaleMode
        ? `rgba(33, 31, 28, ${alpha.toFixed(3)})`
        : tintFromHitId(sample.hitId, alpha);
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, baselineY - halfHeight);
      this.ctx.lineTo(x, baselineY + halfHeight);
      this.ctx.stroke();
    }

    for (const segment of result.segments) {
      const indices = [segment.startIndex, segment.minDistanceIndex, segment.endIndex];
      for (let j = 0; j < indices.length; j += 1) {
        const sampleIndex = indices[j];
        if (sampleIndex === undefined) {
          continue;
        }
        const sample = samples[sampleIndex];
        if (!sample || sample.hitId === null) {
          continue;
        }

        const x = count <= 1 ? width / 2 : (sampleIndex / (count - 1)) * width;
        const isClosest = j === 1;
        const radius = isClosest ? 3.2 : 2.2;
        const alpha = Math.max(0.2, Math.min(1, sample.intensity * (isClosest ? 1 : 0.8)));
        const fill = cfg.grayscaleMode
          ? `rgba(22, 20, 18, ${alpha.toFixed(3)})`
          : tintFromHitId(sample.hitId, alpha);

        this.ctx.fillStyle = fill;
        this.ctx.beginPath();
        this.ctx.arc(x, baselineY, radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    const forwardX = width * 0.5;
    this.ctx.strokeStyle = 'rgba(34, 33, 30, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(forwardX, baselineY - 18);
    this.ctx.lineTo(forwardX, baselineY + 18);
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(34, 33, 30, 0.8)';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(`heading ${viewerHeadingRad.toFixed(2)} rad`, 8, 6);

    this.ctx.strokeStyle = 'rgba(78, 72, 61, 0.18)';
    this.ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
