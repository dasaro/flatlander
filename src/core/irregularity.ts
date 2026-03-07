import { maxAngleDeviationDegrees, radialDeviation, radialPolygonVertices, regularPolygonVertices } from '../geometry/polygon';
import { distance, vec } from '../geometry/vector';
import type { IrregularityComponent } from './components';
import { Rank } from './rank';
import type { RankComponent } from './rank';
import type { PolygonShape, ShapeComponent } from './shapes';

export const CANON_CURABLE_DEVIATION_DEG = 0.75;

export type IrregularDisposition = 'curable' | 'monitored' | 'condemned';

export interface IrregularMetrics {
  deviation: number;
  angleDeviationDeg: number;
}

function boundingRadius(vertices: Array<{ x: number; y: number }>): number {
  return vertices.reduce((max, vertex) => Math.max(max, distance(vertex, vec(0, 0))), 0);
}

export function irregularAngleDeviationDeg(
  shape: ShapeComponent | undefined,
  irregularity: IrregularityComponent | null | undefined,
): number {
  if (irregularity?.angleDeviationDeg !== undefined && Number.isFinite(irregularity.angleDeviationDeg)) {
    return Math.max(0, irregularity.angleDeviationDeg);
  }
  if (!shape || shape.kind !== 'polygon') {
    return 0;
  }
  if (shape.maxDeviationDeg !== undefined && Number.isFinite(shape.maxDeviationDeg)) {
    return Math.max(0, shape.maxDeviationDeg);
  }
  return maxAngleDeviationDegrees(shape.vertices);
}

export function irregularFrameHasSet(ageTicks: number, frameSetTicks: number): boolean {
  return Math.max(0, ageTicks) >= Math.max(0, Math.round(frameSetTicks));
}

export function classifyIrregularDisposition(options: {
  ageTicks: number;
  frameSetTicks: number;
  deviationDeg: number;
  curableDeviationDeg: number;
  executionDeviationDeg: number;
}): IrregularDisposition {
  const ageTicks = Math.max(0, options.ageTicks);
  const frameSetTicks = Math.max(0, Math.round(options.frameSetTicks));
  const deviationDeg = Math.max(0, options.deviationDeg);
  const curableDeviationDeg = Math.max(0, options.curableDeviationDeg);
  const executionDeviationDeg = Math.max(curableDeviationDeg, options.executionDeviationDeg);

  if (!irregularFrameHasSet(ageTicks, frameSetTicks)) {
    return 'curable';
  }
  if (deviationDeg <= curableDeviationDeg) {
    return 'curable';
  }
  if (deviationDeg >= executionDeviationDeg) {
    return 'condemned';
  }
  return 'monitored';
}

export function updatePolygonFromRadialProfile(
  shape: PolygonShape,
  baseRadius: number,
  radial: number[],
): IrregularMetrics {
  const vertices = radialPolygonVertices(shape.sides, baseRadius, radial);
  const deviation = radialDeviation(radial);
  const angleDeviationDeg = maxAngleDeviationDegrees(vertices);

  shape.vertices = vertices;
  shape.boundingRadius = boundingRadius(vertices);
  shape.baseRadius = baseRadius;
  shape.radial = [...radial];
  shape.irregularity = deviation;
  shape.maxDeviationDeg = angleDeviationDeg;
  shape.irregular = true;
  shape.regular = false;

  return {
    deviation,
    angleDeviationDeg,
  };
}

export function regularizePolygonShape(shape: PolygonShape): void {
  const baseRadius = shape.baseRadius ?? shape.boundingRadius;
  const vertices = regularPolygonVertices(shape.sides, baseRadius);
  shape.vertices = vertices;
  shape.boundingRadius = boundingRadius(vertices);
  shape.irregularity = 0;
  shape.irregular = false;
  shape.regular = true;
  delete shape.radial;
  delete shape.baseRadius;
  delete shape.maxDeviationDeg;
}

export function isMarriageEligibleFigure(
  rank: RankComponent | undefined,
  shape: ShapeComponent | undefined,
): boolean {
  // Flatland Part I §7: irregulars are prevented from marriage.
  if (!rank || !shape) {
    return false;
  }
  if (rank.rank === Rank.Irregular) {
    return false;
  }
  return !(shape.kind === 'polygon' && (shape.irregular ?? false));
}
