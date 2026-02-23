import type { EyeComponent } from './components';
import type { ShapeComponent } from './shapes';
import type { World } from './world';
import { add, angleToVector, clamp, normalize, rotate, vec } from '../geometry/vector';
import type { Vec2 } from '../geometry/vector';

const MIN_EYE_FOV_DEG = 60;
const MAX_EYE_FOV_DEG = 300;

function clampEyeFovDeg(value: number): number {
  return clamp(value, MIN_EYE_FOV_DEG, MAX_EYE_FOV_DEG);
}

function normalizeOrFallback(value: Vec2, fallback: Vec2): Vec2 {
  const unit = normalize(value);
  if (Math.abs(unit.x) < 1e-6 && Math.abs(unit.y) < 1e-6) {
    return fallback;
  }
  return unit;
}

function vertexAt(vertices: Vec2[], index: number): Vec2 {
  const wrapped = ((index % vertices.length) + vertices.length) % vertices.length;
  const vertex = vertices[wrapped];
  if (!vertex) {
    return vec(1, 0);
  }
  return vertex;
}

function smallestAngleVertexIndex(vertices: Vec2[]): number {
  if (vertices.length < 3) {
    return 0;
  }

  let bestIndex = 0;
  let bestAngle = Number.POSITIVE_INFINITY;
  for (let i = 0; i < vertices.length; i += 1) {
    const prev = vertexAt(vertices, i - 1);
    const curr = vertexAt(vertices, i);
    const next = vertexAt(vertices, i + 1);
    const a = normalizeOrFallback(
      {
        x: prev.x - curr.x,
        y: prev.y - curr.y,
      },
      vec(-1, 0),
    );
    const b = normalizeOrFallback(
      {
        x: next.x - curr.x,
        y: next.y - curr.y,
      },
      vec(1, 0),
    );
    const cosine = clamp(a.x * b.x + a.y * b.y, -1, 1);
    const angle = Math.acos(cosine);
    if (angle < bestAngle) {
      bestAngle = angle;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function eyeForPolygon(shape: ShapeComponent): { localEye: Vec2; localForward: Vec2 } {
  if (shape.kind !== 'polygon' || shape.vertices.length === 0) {
    return {
      localEye: vec(1, 0),
      localForward: vec(1, 0),
    };
  }

  let eyeVertexIndex = 0;
  if (shape.sides === 3 && shape.triangleKind === 'Isosceles' && shape.vertices.length === 3) {
    // Keep the eye on a base vertex, not the acute apex, per novel texture.
    const apexIndex = smallestAngleVertexIndex(shape.vertices);
    eyeVertexIndex = (apexIndex + 1) % 3;
  }

  const localEye = vertexAt(shape.vertices, eyeVertexIndex);
  const localForward = normalizeOrFallback(localEye, vec(1, 0));
  return { localEye, localForward };
}

export function computeDefaultEyeComponent(
  shape: ShapeComponent,
  defaultFovDeg = 180,
): EyeComponent {
  const clampedFovDeg = clampEyeFovDeg(defaultFovDeg);
  const fovRad = (clampedFovDeg * Math.PI) / 180;

  if (shape.kind === 'segment') {
    return {
      localEye: vec(shape.length * 0.5, 0),
      localForward: vec(1, 0),
      fovRad,
    };
  }

  if (shape.kind === 'circle') {
    return {
      localEye: vec(shape.radius, 0),
      localForward: vec(1, 0),
      fovRad,
    };
  }

  const polygonEye = eyeForPolygon(shape);
  return {
    localEye: polygonEye.localEye,
    localForward: polygonEye.localForward,
    fovRad,
  };
}

export function eyePoseWorld(
  world: World,
  entityId: number,
): { eyeWorld: Vec2; forwardWorld: Vec2; fovRad: number } | null {
  const transform = world.transforms.get(entityId);
  const shape = world.shapes.get(entityId);
  if (!transform || !shape) {
    return null;
  }

  const eyeComponent =
    world.eyes.get(entityId) ?? computeDefaultEyeComponent(shape, world.config.defaultEyeFovDeg);
  const localForward = normalizeOrFallback(eyeComponent.localForward, vec(1, 0));
  const eyeWorld = add(transform.position, rotate(eyeComponent.localEye, transform.rotation));
  const rotatedForward = rotate(localForward, transform.rotation);
  const forwardWorld = normalizeOrFallback(rotatedForward, angleToVector(transform.rotation));

  return {
    eyeWorld,
    forwardWorld,
    fovRad: clamp(eyeComponent.fovRad, (MIN_EYE_FOV_DEG * Math.PI) / 180, (MAX_EYE_FOV_DEG * Math.PI) / 180),
  };
}

