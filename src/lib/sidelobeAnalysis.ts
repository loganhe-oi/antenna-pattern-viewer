import type { PatternPoint } from '../types/msi';
import { buildLossArray } from './patternUtils';

export interface LobeInfo {
  angleDeg: number;
  lossdB: number;
  /** Relative level in dB (loss difference from main lobe) */
  relativedB: number;
}

export interface NullInfo {
  angleDeg: number;
  lossdB: number;
  /** Depth relative to main lobe */
  depthdB: number;
}

export interface SidelobeResult {
  mainLobe: LobeInfo;
  sidelobes: LobeInfo[];
  nulls: NullInfo[];
  /** First sidelobe level in dB (positive = below main lobe) */
  firstSLL: number | null;
  /** Front-to-back ratio computed from pattern */
  computedFBRatio: number | null;
  /** Squint angle: offset of main lobe from 0 degrees */
  squintAngle: number;
}

/**
 * 3-point moving average smoothing of a loss array.
 * Wraps around 360 degrees.
 */
function smooth(loss: Float64Array): Float64Array {
  const out = new Float64Array(360);
  for (let i = 0; i < 360; i++) {
    const prev = loss[((i - 1) + 360) % 360];
    const curr = loss[i];
    const next = loss[(i + 1) % 360];
    // Skip NaN entries
    if (isNaN(prev) || isNaN(curr) || isNaN(next)) {
      out[i] = curr;
    } else {
      out[i] = (prev + curr + next) / 3;
    }
  }
  return out;
}

/**
 * Find local minima in loss array (= gain peaks = lobes).
 * A minimum is where loss[i] <= loss[i-1] and loss[i] <= loss[i+1].
 */
function findLocalMinima(loss: Float64Array): { angle: number; loss: number }[] {
  const minima: { angle: number; loss: number }[] = [];
  for (let i = 0; i < 360; i++) {
    if (isNaN(loss[i])) continue;
    const prev = loss[((i - 1) + 360) % 360];
    const next = loss[(i + 1) % 360];
    if (isNaN(prev) || isNaN(next)) continue;
    if (loss[i] <= prev && loss[i] <= next) {
      minima.push({ angle: i, loss: loss[i] });
    }
  }
  return minima;
}

/**
 * Find local maxima in loss array (= gain dips = nulls).
 */
function findLocalMaxima(loss: Float64Array): { angle: number; loss: number }[] {
  const maxima: { angle: number; loss: number }[] = [];
  for (let i = 0; i < 360; i++) {
    if (isNaN(loss[i])) continue;
    const prev = loss[((i - 1) + 360) % 360];
    const next = loss[(i + 1) % 360];
    if (isNaN(prev) || isNaN(next)) continue;
    if (loss[i] >= prev && loss[i] >= next && loss[i] > 1) {
      maxima.push({ angle: i, loss: loss[i] });
    }
  }
  return maxima;
}

/**
 * Angular distance between two angles (0-360), result is 0-180.
 */
function angularDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Analyze sidelobes, nulls, and key metrics for a pattern.
 */
export function analyzeSidelobes(pattern: PatternPoint[]): SidelobeResult | null {
  if (pattern.length < 10) return null;

  const rawLoss = buildLossArray(pattern);
  const smoothed = smooth(rawLoss);

  // Find gain peaks (loss minima)
  const peaks = findLocalMinima(smoothed);
  if (peaks.length === 0) return null;

  // Main lobe = lowest loss
  peaks.sort((a, b) => a.loss - b.loss);
  const mainPeak = peaks[0];

  const mainLobe: LobeInfo = {
    angleDeg: mainPeak.angle,
    lossdB: mainPeak.loss,
    relativedB: 0,
  };

  // Sidelobes: all other peaks, sorted by loss
  const sidelobes: LobeInfo[] = peaks
    .slice(1)
    .filter(p => p.loss - mainPeak.loss > 0.5) // at least 0.5 dB below main
    .map(p => ({
      angleDeg: p.angle,
      lossdB: p.loss,
      relativedB: p.loss - mainPeak.loss,
    }))
    .sort((a, b) => a.relativedB - b.relativedB);

  // Nulls: local maxima in loss
  const maxima = findLocalMaxima(smoothed);
  const nulls: NullInfo[] = maxima
    .map(m => ({
      angleDeg: m.angle,
      lossdB: m.loss,
      depthdB: m.loss - mainPeak.loss,
    }))
    .filter(n => n.depthdB > 3) // at least 3 dB deep
    .sort((a, b) => a.depthdB - b.depthdB);

  // First SLL: nearest sidelobe by angular distance
  let firstSLL: number | null = null;
  if (sidelobes.length > 0) {
    const nearestSidelobes = [...sidelobes].sort(
      (a, b) => angularDist(a.angleDeg, mainPeak.angle) - angularDist(b.angleDeg, mainPeak.angle)
    );
    firstSLL = nearestSidelobes[0].relativedB;
  }

  // Computed F/B ratio: loss at 180 degrees from main lobe
  const backAngle = (mainPeak.angle + 180) % 360;
  const backLoss = smoothed[backAngle];
  const computedFBRatio = !isNaN(backLoss) ? backLoss - mainPeak.loss : null;

  // Squint angle: deviation of main lobe from 0 degrees
  const squintAngle = mainPeak.angle > 180 ? mainPeak.angle - 360 : mainPeak.angle;

  return {
    mainLobe,
    sidelobes,
    nulls,
    firstSLL,
    computedFBRatio,
    squintAngle,
  };
}
