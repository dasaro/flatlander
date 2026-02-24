import { describe, expect, it } from 'vitest';

import { getNearestEventfulIndexAtX } from '../src/ui/timelineSelectionState';

describe('timeline selection mapping', () => {
  it('returns null when there are no eventful slices', () => {
    expect(getNearestEventfulIndexAtX(12, 200, 0)).toBeNull();
  });

  it('always returns a valid eventful index when events exist', () => {
    expect(getNearestEventfulIndexAtX(-20, 200, 6)).toBe(0);
    expect(getNearestEventfulIndexAtX(999, 200, 6)).toBe(5);

    const middle = getNearestEventfulIndexAtX(101, 200, 6);
    expect(middle).not.toBeNull();
    expect(middle ?? -1).toBeGreaterThanOrEqual(0);
    expect(middle ?? -1).toBeLessThan(6);
  });
});
