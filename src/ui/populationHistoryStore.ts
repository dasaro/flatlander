export interface PopulationSlice {
  tick: number;
  countsByRankKey: Record<string, number>;
  total: number;
}

function cloneCounts(countsByRankKey: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(countsByRankKey)) {
    out[key] = Math.max(0, Math.round(value));
  }
  return out;
}

function totalFromCounts(countsByRankKey: Record<string, number>): number {
  let total = 0;
  for (const value of Object.values(countsByRankKey)) {
    total += Math.max(0, Math.round(value));
  }
  return total;
}

export function getNearestSliceIndexAtCanvasX(
  x: number,
  canvasWidth: number,
  sliceCount: number,
): number | null {
  if (sliceCount <= 0 || canvasWidth <= 0) {
    return null;
  }
  if (sliceCount === 1) {
    return 0;
  }

  const clampedX = Math.max(0, Math.min(canvasWidth, x));
  const normalized = clampedX / canvasWidth;
  const index = Math.round(normalized * (sliceCount - 1));
  return Math.max(0, Math.min(sliceCount - 1, index));
}

export class PopulationHistoryStore {
  private readonly slicesInternal: PopulationSlice[] = [];
  private lastTick = -1;

  get slices(): ReadonlyArray<PopulationSlice> {
    return this.slicesInternal;
  }

  clear(): void {
    this.slicesInternal.length = 0;
    this.lastTick = -1;
  }

  reset(startTick = 0): void {
    this.slicesInternal.length = 0;
    this.lastTick = Math.max(-1, Math.floor(startTick));
  }

  ingest(worldTick: number, countsByRankKey: Record<string, number>): void {
    const tick = Math.max(0, Math.floor(worldTick));
    if (this.lastTick < 0) {
      this.lastTick = tick;
      return;
    }
    if (tick <= this.lastTick) {
      return;
    }

    const clonedCounts = cloneCounts(countsByRankKey);
    const total = totalFromCounts(clonedCounts);
    for (let t = this.lastTick + 1; t <= tick; t += 1) {
      this.slicesInternal.push({
        tick: t,
        countsByRankKey: clonedCounts,
        total,
      });
    }
    this.lastTick = tick;
  }

  getNearestSliceIndexAtCanvasX(x: number, canvasWidth: number): number | null {
    return getNearestSliceIndexAtCanvasX(x, canvasWidth, this.slicesInternal.length);
  }
}
