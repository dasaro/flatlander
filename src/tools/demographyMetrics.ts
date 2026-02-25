export interface PopulationSampler {
  stepOneTick(): void;
  world: {
    tick: number;
    entities: Set<number>;
  };
}

export function samplePopulation(
  sim: PopulationSampler,
  ticksTotal: number,
  sampleEveryTicks: number,
): number[] {
  const totalTicks = Math.max(0, Math.round(ticksTotal));
  const sampleEvery = Math.max(1, Math.round(sampleEveryTicks));
  const samples: number[] = [sim.world.entities.size];

  for (let tick = 1; tick <= totalTicks; tick += 1) {
    sim.stepOneTick();
    if (tick % sampleEvery === 0) {
      samples.push(sim.world.entities.size);
    }
  }

  return samples;
}

export function movingAverage(series: number[], window: number): number[] {
  if (series.length === 0) {
    return [];
  }
  const size = Math.max(1, Math.round(window));
  if (size === 1) {
    return [...series];
  }

  const out: number[] = [];
  let rolling = 0;
  for (let i = 0; i < series.length; i += 1) {
    const value = series[i] ?? 0;
    rolling += value;
    if (i >= size) {
      rolling -= series[i - size] ?? 0;
    }
    const denom = i < size ? i + 1 : size;
    out.push(rolling / denom);
  }
  return out;
}

export interface ExtremaCounts {
  peaks: number;
  troughs: number;
  alternatingTransitions: number;
}

export function countPeaksAndTroughs(series: number[]): ExtremaCounts {
  if (series.length < 3) {
    return { peaks: 0, troughs: 0, alternatingTransitions: 0 };
  }

  type Extremum = { index: number; kind: 'peak' | 'trough'; value: number };
  const extrema: Extremum[] = [];
  const eps = 1e-9;

  for (let i = 1; i < series.length - 1; i += 1) {
    const prev = series[i - 1] ?? 0;
    const curr = series[i] ?? 0;
    const next = series[i + 1] ?? 0;

    const isPeak = curr >= prev - eps && curr > next + eps;
    const isTrough = curr <= prev + eps && curr < next - eps;

    if (!isPeak && !isTrough) {
      continue;
    }

    const kind: 'peak' | 'trough' = isPeak ? 'peak' : 'trough';
    const previous = extrema[extrema.length - 1];
    if (previous && previous.kind === kind) {
      if ((kind === 'peak' && curr > previous.value) || (kind === 'trough' && curr < previous.value)) {
        extrema[extrema.length - 1] = { index: i, kind, value: curr };
      }
      continue;
    }

    extrema.push({ index: i, kind, value: curr });
  }

  let peaks = 0;
  let troughs = 0;
  let alternatingTransitions = 0;
  for (let i = 0; i < extrema.length; i += 1) {
    if (extrema[i]?.kind === 'peak') {
      peaks += 1;
    } else {
      troughs += 1;
    }
    if (i > 0 && extrema[i - 1]?.kind !== extrema[i]?.kind) {
      alternatingTransitions += 1;
    }
  }

  return { peaks, troughs, alternatingTransitions };
}

export function oscillationAmplitude(series: number[]): number {
  if (series.length === 0) {
    return 0;
  }
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  for (const value of series) {
    min = Math.min(min, value);
    max = Math.max(max, value);
    sum += value;
  }
  const mean = sum / series.length;
  if (mean <= 0) {
    return 0;
  }
  return (max - min) / mean;
}
