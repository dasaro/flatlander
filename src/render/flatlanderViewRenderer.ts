import type { FlatlanderScanResult, FlatlanderViewConfig } from './flatlanderScan';

function tintFromHitId(hitId: number, alpha: number): string {
  if (hitId < 0) {
    return `hsla(34, 24%, 38%, ${alpha.toFixed(3)})`;
  }
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

  render(
    result: FlatlanderScanResult,
    cfg: FlatlanderViewConfig,
    viewerHeadingRad: number,
    highlightHitId: number | null = null,
    highlightSampleIndex: number | null = null,
  ): void {
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

      const isHighlightedHit = highlightHitId !== null && sample.hitId === highlightHitId;
      const isHighlightedSample = highlightSampleIndex !== null && i === highlightSampleIndex;
      const isHighlighted = isHighlightedHit || isHighlightedSample;
      const x = count <= 1 ? width / 2 : (i / (count - 1)) * width;
      const visualIntensity = Math.max(0, Math.min(1, sample.intensity ** 1.4));
      const alpha = isHighlighted
        ? Math.max(0.72, Math.min(1, visualIntensity + 0.2))
        : Math.max(0.05, Math.min(1, visualIntensity));
      const halfHeight = 2 + visualIntensity * 10 + (isHighlighted ? 4 : 0);

      this.ctx.strokeStyle = cfg.grayscaleMode
        ? `rgba(33, 31, 28, ${alpha.toFixed(3)})`
        : tintFromHitId(sample.hitId, alpha);
      this.ctx.lineWidth = isHighlighted ? 2 : 1;
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
        const isHighlightedHit = highlightHitId !== null && sample.hitId === highlightHitId;
        const radius = isClosest ? (isHighlightedHit ? 4.1 : 3.2) : isHighlightedHit ? 3.1 : 2.2;
        const visualIntensity = Math.max(0, Math.min(1, sample.intensity ** 1.4));
        const alpha = Math.max(0.2, Math.min(1, visualIntensity * (isClosest ? 1 : 0.8)));
        const fill = cfg.grayscaleMode
          ? `rgba(22, 20, 18, ${alpha.toFixed(3)})`
          : tintFromHitId(sample.hitId, alpha);

        this.ctx.fillStyle = fill;
        this.ctx.beginPath();
        this.ctx.arc(x, baselineY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        if (isHighlightedHit) {
          this.ctx.strokeStyle = 'rgba(24, 22, 19, 0.92)';
          this.ctx.lineWidth = 1.1;
          this.ctx.stroke();
        }
      }
    }

    if (highlightSampleIndex !== null && highlightSampleIndex >= 0 && highlightSampleIndex < count) {
      const x =
        count <= 1 ? width / 2 : (highlightSampleIndex / (count - 1)) * width;
      this.ctx.strokeStyle = 'rgba(31, 29, 26, 0.45)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    const forwardX = width * 0.5;
    this.ctx.strokeStyle = 'rgba(34, 33, 30, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(forwardX, baselineY - 18);
    this.ctx.lineTo(forwardX, baselineY + 18);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(0.5, baselineY - 10);
    this.ctx.lineTo(0.5, baselineY + 10);
    this.ctx.moveTo(width - 0.5, baselineY - 10);
    this.ctx.lineTo(width - 0.5, baselineY + 10);
    this.ctx.stroke();

    this.ctx.fillStyle = 'rgba(34, 33, 30, 0.8)';
    this.ctx.font = '11px Trebuchet MS, sans-serif';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(
      `heading ${viewerHeadingRad.toFixed(2)} rad  fov ${((result.fovRad * 180) / Math.PI).toFixed(0)}°`,
      8,
      6,
    );
    if (highlightHitId !== null) {
      this.ctx.textAlign = 'right';
      this.ctx.fillStyle = 'rgba(34, 33, 30, 0.76)';
      this.ctx.fillText(`hover #${highlightHitId}`, width - 8, 6);
    }

    this.ctx.strokeStyle = 'rgba(78, 72, 61, 0.18)';
    this.ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
