import type { World } from './world';
import type { System } from '../systems/system';

export class FixedTimestepSimulation {
  private accumulator = 0;
  private lastTimeMs = 0;
  private running = false;

  constructor(
    public world: World,
    private readonly systems: System[],
    private readonly maxFrameDeltaSeconds = 0.25,
  ) {}

  get isRunning(): boolean {
    return this.running;
  }

  setRunning(running: boolean): void {
    this.running = running;
  }

  toggleRunning(): boolean {
    this.running = !this.running;
    return this.running;
  }

  setWorld(world: World): void {
    this.world = world;
    this.accumulator = 0;
    this.lastTimeMs = 0;
  }

  frame(nowMs: number): number {
    if (this.lastTimeMs === 0) {
      this.lastTimeMs = nowMs;
      return 0;
    }

    const rawDeltaSeconds = (nowMs - this.lastTimeMs) / 1000;
    this.lastTimeMs = nowMs;

    if (!this.running) {
      return 0;
    }

    const deltaSeconds = Math.min(this.maxFrameDeltaSeconds, rawDeltaSeconds);
    this.accumulator += deltaSeconds;

    const tickDuration = 1 / this.world.config.tickRate;
    let ticks = 0;

    while (this.accumulator >= tickDuration) {
      this.stepOneTick();
      this.accumulator -= tickDuration;
      ticks += 1;
    }

    return ticks;
  }

  stepOneTick(): void {
    const tickDuration = 1 / this.world.config.tickRate;
    this.world.tick += 1;
    this.world.collisions = [];
    this.world.manifolds = [];
    this.world.deathsThisTick = 0;
    this.world.regularizedThisTick = 0;
    this.world.handshakeStartedThisTick = 0;
    this.world.handshakeCompletedThisTick = 0;

    for (const system of this.systems) {
      system.update(this.world, tickDuration);
    }
  }
}
