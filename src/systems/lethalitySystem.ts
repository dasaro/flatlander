import type { SupportFeature } from '../geometry/collisionManifold';
import type { GeometryShape } from '../geometry/intersections';
import { rankKeyForEntity } from '../core/rankKey';
import { clamp, normalize, sub } from '../geometry/vector';
import type { World } from '../core/world';
import type { System } from './system';

function wrappedVertex(vertices: Array<{ x: number; y: number }>, index: number): { x: number; y: number } {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Failed to resolve polygon vertex for lethality.');
  }
  return vertex;
}

function vertexInternalAngle(vertices: Array<{ x: number; y: number }>, index: number): number {
  const prev = wrappedVertex(vertices, index - 1);
  const curr = wrappedVertex(vertices, index);
  const next = wrappedVertex(vertices, index + 1);
  const a = normalize(sub(prev, curr));
  const b = normalize(sub(next, curr));
  const cosine = clamp(a.x * b.x + a.y * b.y, -1, 1);
  return Math.acos(cosine);
}

function sharpnessFromFeature(shape: GeometryShape, feature: SupportFeature): number {
  if (feature.kind === 'circle' || feature.kind === 'edge') {
    return 0;
  }

  if (feature.kind === 'endpoint') {
    return 1;
  }

  if (shape.kind !== 'polygon' || feature.index === undefined) {
    return 0;
  }

  const angle = vertexInternalAngle(shape.vertices, feature.index);
  return clamp((Math.PI - angle) / Math.PI, 0, 1);
}

function isVertexAttacker(feature: SupportFeature): boolean {
  return feature.kind === 'vertex' || feature.kind === 'endpoint';
}

function pressureKey(attackerId: number, victimId: number): string {
  return `${attackerId}->${victimId}`;
}

function registerKill(world: World, killerId: number, victimId: number): void {
  if (world.pendingDeaths.has(victimId)) {
    return;
  }

  world.pendingDeaths.add(victimId);
  const stats = world.combatStats.get(killerId);
  if (stats) {
    stats.kills += 1;
  }
  const legacy = world.legacy.get(killerId);
  if (legacy) {
    legacy.deathsCaused += 1;
  }

  const victimTransform = world.transforms.get(victimId);
  if (!victimTransform) {
    return;
  }

  world.events.push({
    type: 'death',
    tick: world.tick,
    entityId: victimId,
    pos: victimTransform.position,
    rankKey: rankKeyForEntity(world, victimId),
    killerId,
  });
}

function applyBlunting(world: World, entityId: number, sharpness: number): number {
  const durability = world.durability.get(entityId);
  if (!durability || durability.maxHp <= 0) {
    return sharpness;
  }

  const hpRatio = clamp(durability.hp / durability.maxHp, 0, 1);
  const exponent = Math.max(0, world.config.bluntExponent);
  return sharpness * hpRatio ** exponent;
}

function evaluateDirectionalStab(
  world: World,
  attackerId: number,
  victimId: number,
  attackerShape: GeometryShape,
  attackerFeature: SupportFeature,
  closingSpeed: number,
  penetration: number,
  contactPoint: { x: number; y: number },
  activePressureKeys: Set<string>,
): void {
  if (world.staticObstacles.has(attackerId) || world.staticObstacles.has(victimId)) {
    return;
  }

  if (!isVertexAttacker(attackerFeature)) {
    world.stabPressure.delete(pressureKey(attackerId, victimId));
    return;
  }

  const sharpness = sharpnessFromFeature(attackerShape, attackerFeature);
  const adjustedSharpness = applyBlunting(world, attackerId, sharpness);
  if (adjustedSharpness <= 0) {
    world.stabPressure.delete(pressureKey(attackerId, victimId));
    return;
  }

  world.events.push({
    type: 'stab',
    tick: world.tick,
    attackerId,
    victimId,
    pos: contactPoint,
    sharpness: adjustedSharpness,
    attackerRankKey: rankKeyForEntity(world, attackerId),
    victimRankKey: rankKeyForEntity(world, victimId),
  });

  const exponent = Math.max(0.1, world.config.stabSharpnessExponent);
  const sharpnessPower = adjustedSharpness ** exponent;
  const impactSeverity = sharpnessPower * Math.max(0, closingSpeed);

  const key = pressureKey(attackerId, victimId);
  let pressureTicks = 0;
  const pressing = penetration >= 0;
  if (pressing) {
    const pressure = world.stabPressure.get(key) ?? { ticks: 0 };
    pressure.ticks += 1;
    world.stabPressure.set(key, pressure);
    pressureTicks = pressure.ticks;
    activePressureKeys.add(key);
  } else {
    world.stabPressure.delete(key);
  }

  const ticksToKill = Math.max(1, Math.round(world.config.pressureTicksToKill));
  const pressureSeverity =
    sharpnessPower * (pressureTicks / ticksToKill) * world.config.killSeverityThreshold;
  const totalSeverity = impactSeverity + pressureSeverity;
  if (totalSeverity >= world.config.killSeverityThreshold) {
    registerKill(world, attackerId, victimId);
  }
}

export class LethalitySystem implements System {
  update(world: World): void {
    const activePressureKeys = new Set<string>();
    const manifolds = [...world.manifolds].sort((left, right) => {
      if (left.aId !== right.aId) {
        return left.aId - right.aId;
      }
      return left.bId - right.bId;
    });

    for (const manifold of manifolds) {
      const { aId, bId } = manifold;
      if (world.pendingDeaths.has(aId) || world.pendingDeaths.has(bId)) {
        continue;
      }

      const aShape = world.geometries.get(aId);
      const bShape = world.geometries.get(bId);
      if (!aShape || !bShape) {
        continue;
      }

      evaluateDirectionalStab(
        world,
        aId,
        bId,
        aShape,
        manifold.featureA,
        manifold.closingSpeed,
        manifold.penetration,
        manifold.contactPoint,
        activePressureKeys,
      );

      evaluateDirectionalStab(
        world,
        bId,
        aId,
        bShape,
        manifold.featureB,
        manifold.closingSpeed,
        manifold.penetration,
        manifold.contactPoint,
        activePressureKeys,
      );
    }

    for (const key of [...world.stabPressure.keys()]) {
      if (!activePressureKeys.has(key)) {
        world.stabPressure.delete(key);
      }
    }
  }
}
