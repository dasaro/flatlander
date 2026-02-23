import { describe, expect, it } from 'vitest';

import { spawnEntity } from '../src/core/factory';
import { computeDefaultEyeComponent, eyePoseWorld } from '../src/core/eyePose';
import { createWorld } from '../src/core/world';
import { clamp, normalize, sub } from '../src/geometry/vector';
import type { Vec2 } from '../src/geometry/vector';
import type { PolygonShape } from '../src/core/shapes';

function wrappedVertex(vertices: Vec2[], index: number): Vec2 {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    throw new Error('Missing wrapped vertex in eye pose test.');
  }
  return vertex;
}

function smallestAngleVertexIndex(vertices: Vec2[]): number {
  let bestIndex = 0;
  let bestAngle = Number.POSITIVE_INFINITY;

  for (let i = 0; i < vertices.length; i += 1) {
    const prev = wrappedVertex(vertices, i - 1);
    const curr = wrappedVertex(vertices, i);
    const next = wrappedVertex(vertices, i + 1);
    const a = normalize(sub(prev, curr));
    const b = normalize(sub(next, curr));
    const cosine = clamp(a.x * b.x + a.y * b.y, -1, 1);
    const angle = Math.acos(cosine);
    if (angle < bestAngle) {
      bestAngle = angle;
      bestIndex = i;
    }
  }

  return bestIndex;
}

describe('eye pose', () => {
  it('places women eye on the front endpoint at rotation 0', () => {
    const world = createWorld(1001);
    const womanId = spawnEntity(
      world,
      { kind: 'segment', size: 24 },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 150, y: 160 },
    );

    const transform = world.transforms.get(womanId);
    if (!transform) {
      throw new Error('Missing transform in eye pose segment test.');
    }
    transform.rotation = 0;

    const pose = eyePoseWorld(world, womanId);
    expect(pose).not.toBeNull();
    expect(pose?.eyeWorld.x).toBeCloseTo(162, 8);
    expect(pose?.eyeWorld.y).toBeCloseTo(160, 8);
    expect(pose?.forwardWorld.x).toBeCloseTo(1, 8);
    expect(pose?.forwardWorld.y).toBeCloseTo(0, 8);
  });

  it('places polygon eye on a perimeter vertex', () => {
    const world = createWorld(1002);
    const polygonId = spawnEntity(
      world,
      { kind: 'polygon', sides: 5, size: 18, irregular: false },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 220, y: 220 },
    );

    const shape = world.shapes.get(polygonId);
    const eye = world.eyes.get(polygonId);
    if (!shape || shape.kind !== 'polygon' || !eye) {
      throw new Error('Missing polygon eye metadata in eye placement test.');
    }

    const matchesVertex = shape.vertices.some(
      (vertex) =>
        Math.abs(vertex.x - eye.localEye.x) <= 1e-9 &&
        Math.abs(vertex.y - eye.localEye.y) <= 1e-9,
    );
    expect(matchesVertex).toBe(true);
    expect(Math.hypot(eye.localForward.x, eye.localForward.y)).toBeCloseTo(1, 8);
  });

  it('for isosceles triangles, eye is not on the apex vertex', () => {
    const world = createWorld(1003);
    const triangleId = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 18,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.05,
      },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 260, y: 260 },
    );

    const shape = world.shapes.get(triangleId) as PolygonShape | undefined;
    const eye = world.eyes.get(triangleId);
    if (!shape || shape.kind !== 'polygon' || !eye) {
      throw new Error('Missing isosceles shape/eye in apex exclusion test.');
    }
    const apexIndex = smallestAngleVertexIndex(shape.vertices);
    const apex = shape.vertices[apexIndex];
    if (!apex) {
      throw new Error('Missing apex vertex in apex exclusion test.');
    }

    const eyeIsApex =
      Math.abs(apex.x - eye.localEye.x) <= 1e-9 &&
      Math.abs(apex.y - eye.localEye.y) <= 1e-9;
    expect(eyeIsApex).toBe(false);
  });

  it('keeps eye attached to evolving shape geometry', () => {
    const world = createWorld(1004);
    const triangleId = spawnEntity(
      world,
      {
        kind: 'polygon',
        sides: 3,
        size: 18,
        irregular: false,
        triangleKind: 'Isosceles',
        isoscelesBaseRatio: 0.08,
      },
      { type: 'straightDrift', vx: 0, vy: 0, boundary: 'wrap' },
      { x: 200, y: 180 },
    );

    const initialPose = eyePoseWorld(world, triangleId);
    expect(initialPose).not.toBeNull();

    const shape = world.shapes.get(triangleId);
    if (!shape || shape.kind !== 'polygon') {
      throw new Error('Missing polygon shape for eye attachment test.');
    }

    // Simulate shape evolution (e.g. compensation/regularization) by mutating local vertices.
    shape.vertices = shape.vertices.map((vertex) =>
      ({ x: vertex.x * 0.72, y: vertex.y * 0.72 }),
    );
    const recomputedEye = computeDefaultEyeComponent(shape, world.config.defaultEyeFovDeg);
    const transform = world.transforms.get(triangleId);
    if (!transform) {
      throw new Error('Missing transform for eye attachment test.');
    }
    const cos = Math.cos(transform.rotation);
    const sin = Math.sin(transform.rotation);
    const expectedWorldEye = {
      x: transform.position.x + recomputedEye.localEye.x * cos - recomputedEye.localEye.y * sin,
      y: transform.position.y + recomputedEye.localEye.x * sin + recomputedEye.localEye.y * cos,
    };

    const updatedPose = eyePoseWorld(world, triangleId);
    expect(updatedPose).not.toBeNull();
    expect(updatedPose?.eyeWorld.x).toBeCloseTo(expectedWorldEye.x, 6);
    expect(updatedPose?.eyeWorld.y).toBeCloseTo(expectedWorldEye.y, 6);
  });
});
