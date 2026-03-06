export interface SystemStackAudit {
  ok: boolean;
  issues: string[];
}

function requireOrderedPair(
  names: string[],
  before: string,
  after: string,
  issues: string[],
): void {
  const beforeIndex = names.indexOf(before);
  const afterIndex = names.indexOf(after);
  if (beforeIndex === -1 || afterIndex === -1) {
    issues.push(`missing required systems for ordering check: ${before}, ${after}`);
    return;
  }
  if (beforeIndex >= afterIndex) {
    issues.push(`${before} must run before ${after}`);
  }
}

export function auditDefaultSystemStack(names: string[]): SystemStackAudit {
  const issues: string[] = [];
  if (!names.includes('CivicOrderSystem')) {
    issues.push('CivicOrderSystem missing from default shipped stack');
  }
  requireOrderedPair(names, 'SocialNavMindSystem', 'CivicOrderSystem', issues);
  requireOrderedPair(names, 'CivicOrderSystem', 'FeelingApproachSystem', issues);
  requireOrderedPair(names, 'InspectionSystem', 'StillnessControllerSystem', issues);
  requireOrderedPair(names, 'CollisionSystem', 'HouseSystem', issues);
  requireOrderedPair(names, 'HouseSystem', 'FeelingSystem', issues);
  requireOrderedPair(names, 'FeelingSystem', 'CollisionResolutionSystem', issues);
  requireOrderedPair(names, 'CleanupSystem', 'ReproductionSystem', issues);
  return {
    ok: issues.length === 0,
    issues,
  };
}
