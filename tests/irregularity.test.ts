import { describe, expect, it } from 'vitest';

import { classifyIrregularDisposition, isMarriageEligibleFigure } from '../src/core/irregularity';
import { Rank } from '../src/core/rank';
import type { ShapeComponent } from '../src/core/shapes';

describe('irregularity helpers', () => {
  it('classifies curable, monitored, and condemned deviations by age and angle', () => {
    expect(
      classifyIrregularDisposition({
        ageTicks: 100,
        frameSetTicks: 900,
        deviationDeg: 1.2,
        curableDeviationDeg: 0.75,
        executionDeviationDeg: 1.4,
      }),
    ).toBe('curable');

    expect(
      classifyIrregularDisposition({
        ageTicks: 1200,
        frameSetTicks: 900,
        deviationDeg: 0.5,
        curableDeviationDeg: 0.75,
        executionDeviationDeg: 1.4,
      }),
    ).toBe('curable');

    expect(
      classifyIrregularDisposition({
        ageTicks: 1200,
        frameSetTicks: 900,
        deviationDeg: 1.0,
        curableDeviationDeg: 0.75,
        executionDeviationDeg: 1.4,
      }),
    ).toBe('monitored');

    expect(
      classifyIrregularDisposition({
        ageTicks: 1200,
        frameSetTicks: 900,
        deviationDeg: 1.6,
        curableDeviationDeg: 0.75,
        executionDeviationDeg: 1.4,
      }),
    ).toBe('condemned');
  });

  it('marks irregular figures as ineligible for marriage', () => {
    const irregularShape: ShapeComponent = {
      kind: 'polygon',
      sides: 5,
      vertices: [],
      irregularity: 0.12,
      regular: false,
      irregular: true,
      boundingRadius: 10,
    };
    const regularShape: ShapeComponent = {
      kind: 'polygon',
      sides: 5,
      vertices: [],
      irregularity: 0,
      regular: true,
      boundingRadius: 10,
    };

    expect(isMarriageEligibleFigure({ rank: Rank.Irregular, tags: [] }, irregularShape)).toBe(false);
    expect(isMarriageEligibleFigure({ rank: Rank.Gentleman, tags: [] }, regularShape)).toBe(true);
  });
});
