import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { getAncestors, getLineagePathToRoot } from '../src/core/genealogy';
import { createWorld } from '../src/core/world';

describe('genealogy helpers', () => {
  it('traverses ancestors deterministically', () => {
    const world = createWorld(500);
    const grandmother = spawnEntity(
      world,
      { kind: 'segment', size: 22 },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 12, maxTurnRate: 1.2, decisionEveryTicks: 20, intentionMinTicks: 90 },
    );
    const grandfather = spawnEntity(
      world,
      { kind: 'polygon', sides: 4, size: 18, irregular: false },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 12, maxTurnRate: 1, decisionEveryTicks: 20, intentionMinTicks: 90 },
    );
    const mother = spawnEntity(
      world,
      { kind: 'segment', size: 20 },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 12, maxTurnRate: 1.2, decisionEveryTicks: 20, intentionMinTicks: 90 },
    );
    const father = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 12, maxTurnRate: 1, decisionEveryTicks: 20, intentionMinTicks: 90 },
    );
    const child = spawnEntity(
      world,
      { kind: 'segment', size: 16 },
      { type: 'socialNav', boundary: 'wrap', maxSpeed: 10, maxTurnRate: 1.2, decisionEveryTicks: 20, intentionMinTicks: 90 },
    );

    world.lineage.set(mother, {
      id: mother,
      birthTick: 0,
      motherId: grandmother,
      fatherId: grandfather,
      generation: 1,
      dynastyId: grandfather,
    });
    world.lineage.set(child, {
      id: child,
      birthTick: 0,
      motherId: mother,
      fatherId: father,
      generation: 2,
      dynastyId: father,
    });

    const ancestors = getAncestors(world, child, 2);
    const ids = ancestors.map((entry) => entry.id);
    expect(ids).toContain(mother);
    expect(ids).toContain(father);
    expect(ids).toContain(grandmother);
    expect(ids).toContain(grandfather);

    const lineagePath = getLineagePathToRoot(world, child);
    expect(lineagePath[0]).toBe(child);
    expect(lineagePath).toContain(father);
  });
});
