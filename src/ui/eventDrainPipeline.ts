import type { WorldEvent } from '../core/events';

export type EventConsumer = (events: WorldEvent[]) => void;

export class EventDrainPipeline {
  private lastProcessedTick: number;

  constructor(
    initialTick: number,
    private readonly drain: () => WorldEvent[],
    private readonly consumers: EventConsumer[],
  ) {
    this.lastProcessedTick = initialTick;
  }

  processForTick(tick: number): void {
    if (tick === this.lastProcessedTick) {
      return;
    }

    const events = this.drain();
    for (const consumer of this.consumers) {
      consumer(events);
    }
    this.lastProcessedTick = tick;
  }

  reset(tick: number): void {
    this.lastProcessedTick = tick;
  }
}
