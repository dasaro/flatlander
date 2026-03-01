import { describe, expect, it } from 'vitest';

import { defaultSpawnPlan } from '../src/presets/defaultScenario';

describe('default scenario spawn plan', () => {
  it('includes regular squares in the baseline population', () => {
    const plan = defaultSpawnPlan('wrap');
    const regularSquareCount = plan
      .filter(
        (entry) =>
          entry.shape.kind === 'polygon' &&
          entry.shape.sides === 4 &&
          entry.shape.irregular === false,
      )
      .reduce((sum, entry) => sum + entry.count, 0);
    expect(regularSquareCount).toBeGreaterThanOrEqual(2);
  });
});

