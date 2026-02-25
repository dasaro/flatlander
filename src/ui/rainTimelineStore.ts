export interface RainInterval {
  startTick: number;
  endTick: number;
}

function normalizeTick(tick: number): number {
  if (!Number.isFinite(tick)) {
    return 0;
  }
  return Math.max(0, Math.floor(tick));
}

export class RainTimelineStore {
  private readonly intervals: RainInterval[] = [];
  private activeStartTick: number | null = null;
  private lastTick: number | null = null;

  constructor(private readonly maxIntervals = 2048) {}

  reset(): void {
    this.intervals.length = 0;
    this.activeStartTick = null;
    this.lastTick = null;
  }

  record(tickRaw: number, isRaining: boolean): void {
    const tick = normalizeTick(tickRaw);
    if (this.lastTick !== null && tick < this.lastTick) {
      // Simulation reset or rewind: clear historical visualization.
      this.reset();
    }

    if (isRaining) {
      if (this.activeStartTick === null) {
        this.activeStartTick = tick;
      }
    } else if (this.activeStartTick !== null) {
      this.pushInterval({
        startTick: this.activeStartTick,
        endTick: Math.max(this.activeStartTick, tick),
      });
      this.activeStartTick = null;
    }

    this.lastTick = tick;
  }

  getIntervals(currentTickRaw: number): RainInterval[] {
    const currentTick = normalizeTick(currentTickRaw);
    if (this.activeStartTick === null) {
      return this.intervals.map((interval) => ({ ...interval }));
    }

    return [
      ...this.intervals.map((interval) => ({ ...interval })),
      {
        startTick: this.activeStartTick,
        endTick: Math.max(this.activeStartTick, currentTick),
      },
    ];
  }

  isRainingAtTick(tickRaw: number, currentTickRaw: number): boolean {
    const tick = normalizeTick(tickRaw);
    const intervals = this.getIntervals(currentTickRaw);
    for (const interval of intervals) {
      if (tick >= interval.startTick && tick <= interval.endTick) {
        return true;
      }
    }
    return false;
  }

  private pushInterval(interval: RainInterval): void {
    this.intervals.push(interval);
    if (this.intervals.length > this.maxIntervals) {
      this.intervals.splice(0, this.intervals.length - this.maxIntervals);
    }
  }
}
