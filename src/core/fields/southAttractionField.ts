import { clamp } from '../../geometry/vector';

export function smoothstep01(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

export function southAttractionMultiplier(
  y: number,
  worldHeight: number,
  startFrac: number,
  endFrac: number,
): number {
  if (worldHeight <= 0) {
    return 0;
  }

  const safeStart = clamp(startFrac, 0, 1);
  const safeEnd = clamp(endFrac, 0, 1);
  const start = Math.min(safeStart, safeEnd);
  const end = Math.max(safeStart, safeEnd);

  if (Math.abs(end - start) < 1e-9) {
    return y >= worldHeight * end ? 1 : 0;
  }

  const startY = worldHeight * start;
  const endY = worldHeight * end;
  const t = (y - startY) / (endY - startY);
  return smoothstep01(t);
}
