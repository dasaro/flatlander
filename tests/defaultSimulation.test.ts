import { describe, expect, it } from 'vitest';

import { createDefaultSystems } from '../src/presets/defaultSimulation';
import { auditDefaultSystemStack } from '../src/tools/versionOneReadiness';

describe('default simulation stack', () => {
  it('keeps shipped browser and release-audit ordering aligned', () => {
    const names = createDefaultSystems().map((system) => system.constructor.name);
    const audit = auditDefaultSystemStack(names);

    expect(audit.ok).toBe(true);
    expect(names).toContain('CivicOrderSystem');
    expect(names.indexOf('SocialNavMindSystem')).toBeLessThan(names.indexOf('CivicOrderSystem'));
    expect(names.indexOf('CivicOrderSystem')).toBeLessThan(names.indexOf('FeelingApproachSystem'));
    expect(names.indexOf('CollisionSystem')).toBeLessThan(names.indexOf('HouseSystem'));
    expect(names.indexOf('HouseSystem')).toBeLessThan(names.indexOf('FeelingSystem'));
    expect(names.indexOf('FeelingSystem')).toBeLessThan(names.indexOf('CollisionResolutionSystem'));
  });
});
