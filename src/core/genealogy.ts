import type { EntityId, LineageComponent } from './components';
import type { World } from './world';

export interface AncestorEntry {
  id: EntityId;
  generation: number;
  relation: 'mother' | 'father';
  depth: number;
}

function lineageFor(world: World, id: EntityId): LineageComponent | undefined {
  return world.lineage.get(id);
}

export function getAncestors(world: World, id: EntityId, maxDepth: number): AncestorEntry[] {
  const depthLimit = Math.max(0, Math.round(maxDepth));
  if (depthLimit === 0) {
    return [];
  }

  const out: AncestorEntry[] = [];
  const queue: Array<{ id: EntityId; depth: number }> = [{ id, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (current.depth >= depthLimit) {
      continue;
    }

    const lineage = lineageFor(world, current.id);
    if (!lineage) {
      continue;
    }

    const nextDepth = current.depth + 1;
    if (lineage.motherId !== null) {
      const motherLineage = lineageFor(world, lineage.motherId);
      out.push({
        id: lineage.motherId,
        generation: motherLineage?.generation ?? 0,
        relation: 'mother',
        depth: nextDepth,
      });
      queue.push({ id: lineage.motherId, depth: nextDepth });
    }

    if (lineage.fatherId !== null) {
      const fatherLineage = lineageFor(world, lineage.fatherId);
      out.push({
        id: lineage.fatherId,
        generation: fatherLineage?.generation ?? 0,
        relation: 'father',
        depth: nextDepth,
      });
      queue.push({ id: lineage.fatherId, depth: nextDepth });
    }
  }

  return out;
}

export function getLineagePathToRoot(world: World, id: EntityId): EntityId[] {
  const path: EntityId[] = [];
  let current: EntityId | null = id;
  while (current !== null) {
    path.push(current);
    const lineage = world.lineage.get(current);
    if (!lineage) {
      break;
    }

    if (lineage.fatherId !== null) {
      current = lineage.fatherId;
      continue;
    }

    if (lineage.motherId !== null) {
      current = lineage.motherId;
      continue;
    }

    break;
  }

  return path;
}

export function countLivingDescendants(world: World, ancestorId: EntityId, maxDepth?: number): number {
  const depthLimit = maxDepth === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.round(maxDepth));
  if (depthLimit <= 0) {
    return 0;
  }

  let total = 0;
  const queue: Array<{ id: EntityId; depth: number }> = [{ id: ancestorId, depth: 0 }];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || current.depth >= depthLimit) {
      continue;
    }

    for (const [entityId, lineage] of world.lineage) {
      if (entityId === ancestorId) {
        continue;
      }

      if (lineage.motherId !== current.id && lineage.fatherId !== current.id) {
        continue;
      }

      if (world.entities.has(entityId)) {
        total += 1;
      }

      queue.push({ id: entityId, depth: current.depth + 1 });
    }
  }

  return total;
}
