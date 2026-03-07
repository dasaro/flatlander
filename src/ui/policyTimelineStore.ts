import type { PolicyRegimePhase } from '../core/policy';

export interface PolicyInterval {
  startTick: number;
  endTick: number;
  phase: Exclude<PolicyRegimePhase, 'normal'>;
}

function normalizeTick(tick: number): number {
  if (!Number.isFinite(tick)) {
    return 0;
  }
  return Math.max(0, Math.floor(tick));
}

export class PolicyTimelineStore {
  private readonly intervals: PolicyInterval[] = [];
  private activeInterval: PolicyInterval | null = null;
  private lastTick: number | null = null;

  constructor(private readonly maxIntervals = 2048) {}

  reset(): void {
    this.intervals.length = 0;
    this.activeInterval = null;
    this.lastTick = null;
  }

  record(tickRaw: number, phase: PolicyRegimePhase): void {
    const tick = normalizeTick(tickRaw);
    if (this.lastTick !== null && tick < this.lastTick) {
      this.reset();
    }

    if (phase === 'normal') {
      if (this.activeInterval !== null) {
        this.pushInterval({
          ...this.activeInterval,
          endTick: Math.max(this.activeInterval.startTick, tick),
        });
        this.activeInterval = null;
      }
      this.lastTick = tick;
      return;
    }

    if (this.activeInterval === null) {
      this.activeInterval = {
        startTick: tick,
        endTick: tick,
        phase,
      };
    } else if (this.activeInterval.phase !== phase) {
      this.pushInterval({
        ...this.activeInterval,
        endTick: Math.max(this.activeInterval.startTick, tick),
      });
      this.activeInterval = {
        startTick: tick,
        endTick: tick,
        phase,
      };
    } else {
      this.activeInterval.endTick = Math.max(this.activeInterval.endTick, tick);
    }

    this.lastTick = tick;
  }

  getIntervals(currentTickRaw: number): PolicyInterval[] {
    const currentTick = normalizeTick(currentTickRaw);
    if (this.activeInterval === null) {
      return this.intervals.map((interval) => ({ ...interval }));
    }

    return [
      ...this.intervals.map((interval) => ({ ...interval })),
      {
        ...this.activeInterval,
        endTick: Math.max(this.activeInterval.startTick, currentTick),
      },
    ];
  }

  phaseAtTick(tickRaw: number, currentTickRaw: number): PolicyRegimePhase {
    const tick = normalizeTick(tickRaw);
    const intervals = this.getIntervals(currentTickRaw);
    for (const interval of intervals) {
      if (tick >= interval.startTick && tick <= interval.endTick) {
        return interval.phase;
      }
    }
    return 'normal';
  }

  private pushInterval(interval: PolicyInterval): void {
    this.intervals.push(interval);
    if (this.intervals.length > this.maxIntervals) {
      this.intervals.splice(0, this.intervals.length - this.maxIntervals);
    }
  }
}
