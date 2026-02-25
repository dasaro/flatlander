import type { World } from '../core/world';

export interface FrameEnvironmentState {
  showRainOverlay: boolean;
  showFogOverlay: boolean;
}

export interface FrameSnapshot {
  tick: number;
  isRaining: boolean;
  fogDensity: number;
  showRainOverlay: boolean;
  showFogOverlay: boolean;
}

export function captureFrameSnapshot(
  world: World,
  state: FrameEnvironmentState,
): Readonly<FrameSnapshot> {
  return Object.freeze({
    tick: world.tick,
    isRaining: world.weather.isRaining,
    fogDensity: Math.max(0, world.config.fogDensity),
    showRainOverlay: state.showRainOverlay,
    showFogOverlay: state.showFogOverlay,
  });
}
