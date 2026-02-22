import type { World } from '../core/world';

export interface System {
  update(world: World, dt: number): void;
}
