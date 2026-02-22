import type { BoundaryMode } from './components';

export type WorldTopology = 'torus' | 'bounded';

export function boundaryFromTopology(topology: WorldTopology): BoundaryMode {
  return topology === 'bounded' ? 'bounce' : 'wrap';
}

