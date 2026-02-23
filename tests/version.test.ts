import { describe, expect, it } from 'vitest';

import { APP_VERSION } from '../src/version';

describe('version constant', () => {
  it('is available as a non-empty string', () => {
    expect(typeof APP_VERSION).toBe('string');
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});
