import type { World } from '../core/world';
import { fogFieldConfigFromWorld, type FogFieldConfig } from '../core/fogField';

export interface FrameEnvironmentState {
  showRainOverlay: boolean;
  showFogOverlay: boolean;
}

export interface FrameSnapshot {
  tick: number;
  isRaining: boolean;
  fogDensity: number;
  fogField: Readonly<FogFieldConfig>;
  showRainOverlay: boolean;
  showFogOverlay: boolean;
}

export function captureFrameSnapshot(
  world: World,
  state: FrameEnvironmentState,
): Readonly<FrameSnapshot> {
  const fogField = Object.freeze(fogFieldConfigFromWorld(world));
  return Object.freeze({
    tick: world.tick,
    isRaining: world.weather.isRaining,
    fogDensity: Math.max(0, world.config.fogDensity),
    fogField,
    showRainOverlay: state.showRainOverlay,
    showFogOverlay: state.showFogOverlay,
  });
}
