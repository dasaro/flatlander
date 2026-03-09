import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { createWorld } from '../src/core/world';

describe('spawned durability defaults', () => {
  it('keeps triangles and gentlemen sturdier relative to priests than before', () => {
    const world = createWorld(1, { southAttractionEnabled: false });

    const triangle = spawnEntity(
      world,
      { kind: 'polygon', sides: 3, size: 16, irregular: false, triangleKind: 'Equilateral' },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 100, y: 100 },
    );
    const gentleman = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 120, y: 100 },
    );
    const priest = spawnEntity(
      world,
      { kind: 'circle', size: 14 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 140, y: 100 },
    );

    expect(world.durability.get(triangle)?.maxHp).toBe(48);
    expect(world.durability.get(gentleman)?.maxHp).toBe(52);
    expect(world.durability.get(priest)?.maxHp).toBe(58);
  });
});
