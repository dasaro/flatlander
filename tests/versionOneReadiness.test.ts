import { describe, expect, it } from 'vitest';

import { auditDefaultSystemStack } from '../src/tools/versionOneReadiness';

describe('version-one readiness helpers', () => {
  it('flags missing civic-order alignment in default stack audits', () => {
    const audit = auditDefaultSystemStack([
      'PeaceCrySystem',
      'RainSystem',
      'PolicyRegimeSystem',
      'HearingSystem',
      'VisionSystem',
      'SocialNavMindSystem',
      'FeelingApproachSystem',
    ]);

    expect(audit.ok).toBe(false);
    expect(audit.issues.some((issue) => issue.includes('CivicOrderSystem'))).toBe(true);
  });
});
