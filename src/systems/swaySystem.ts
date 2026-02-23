import { getSortedEntityIds } from '../core/world';
import type { World } from '../core/world';
import type { System } from './system';

const TWO_PI = Math.PI * 2;

function normalizeAngle(angle: number): number {
  let value = angle;
  while (value > Math.PI) {
    value -= TWO_PI;
  }
  while (value < -Math.PI) {
    value += TWO_PI;
  }
  return value;
}

function baseHeading(world: World, entityId: number): number {
  const movement = world.movements.get(entityId);
  if (!movement) {
    return world.transforms.get(entityId)?.rotation ?? 0;
  }

  if (movement.type === 'straightDrift') {
    const driftVy = world.southDrifts.get(entityId)?.vy ?? 0;
    return Math.atan2(movement.vy + driftVy, movement.vx);
  }

  return movement.heading;
}

export class SwaySystem implements System {
  update(world: World, dt: number): void {
    const ids = getSortedEntityIds(world);

    for (const id of ids) {
      const shape = world.shapes.get(id);
      const transform = world.transforms.get(id);
      const sway = world.sway.get(id);
      const femaleStatus = world.femaleStatus.get(id);
      if (!shape || !transform || !sway || !femaleStatus || shape.kind !== 'segment') {
        continue;
      }

      const stillness = world.stillness.get(id);
      if (stillness?.mode === 'full') {
        continue;
      }

      const heading = baseHeading(world, id);
      if (!sway.enabled) {
        transform.rotation = heading;
        continue;
      }

      const frequencyHz = Math.max(0, sway.baseFrequencyHz);
      const amplitude = Math.max(0, sway.baseAmplitudeRad);
      sway.phase = (sway.phase + TWO_PI * frequencyHz * dt) % TWO_PI;

      let offset = amplitude * Math.sin(sway.phase);
      if (femaleStatus.femaleRank === 'High') {
        offset += 0.35 * amplitude * Math.sin(2 * sway.phase + 0.6);
      }

      transform.rotation = normalizeAngle(heading + offset);
    }
  }
}
