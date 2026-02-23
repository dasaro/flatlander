import { clamp } from '../geometry/vector';
import type { FlatlanderSample } from './flatlanderScan';

export interface FlatlanderPickResult {
  sampleIndex: number;
  hitId: number | null;
}

export function sampleIndexFromNormalizedX(
  normalizedX: number,
  sampleCount: number,
): number | null {
  if (sampleCount <= 0 || !Number.isFinite(normalizedX)) {
    return null;
  }

  const safeX = clamp(normalizedX, 0, 1);
  if (sampleCount === 1) {
    return 0;
  }

  return Math.round(safeX * (sampleCount - 1));
}

export function normalizedXFromClientX(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
): number | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(rectLeft) || !Number.isFinite(rectWidth)) {
    return null;
  }
  if (rectWidth <= 0) {
    return null;
  }

  return clamp((clientX - rectLeft) / rectWidth, 0, 1);
}

export function pickFlatlanderSampleAtNormalizedX(
  samples: FlatlanderSample[],
  normalizedX: number,
): FlatlanderPickResult | null {
  const sampleIndex = sampleIndexFromNormalizedX(normalizedX, samples.length);
  if (sampleIndex === null) {
    return null;
  }

  const sample = samples[sampleIndex];
  if (!sample) {
    return null;
  }

  return {
    sampleIndex,
    hitId: sample.hitId,
  };
}
