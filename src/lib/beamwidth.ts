import type { PatternPoint } from '../types/msi';
import type { SidelobeResult } from './sidelobeAnalysis';

export interface BeamwidthResult {
  bw3dB: number | null;
  bw10dB: number | null;
}

export interface ComputedFileData {
  hBeamwidths: BeamwidthResult;
  vBeamwidths: BeamwidthResult;
  hSidelobes?: SidelobeResult | null;
  vSidelobes?: SidelobeResult | null;
}

/**
 * Calculate beamwidth at a given dB threshold from pattern data.
 *
 * Finds the true boresight (angle of minimum loss), then searches outward
 * in both directions for where loss crosses the threshold. Beamwidth is
 * the angular distance between the two crossing points.
 */
export function calculateBeamwidth(
  pattern: PatternPoint[],
  thresholddB: number,
): number | null {
  if (pattern.length < 3) return null;

  // Build lookup indexed by angle (0-359)
  const loss = new Float64Array(360).fill(NaN);
  for (const p of pattern) {
    const a = Math.round(p.angleDeg) % 360;
    loss[a] = p.lossdB;
  }

  // Find boresight: angle with minimum loss
  let boresight = 0;
  let minLoss = Infinity;
  for (let a = 0; a < 360; a++) {
    if (!isNaN(loss[a]) && loss[a] < minLoss) {
      minLoss = loss[a];
      boresight = a;
    }
  }

  // Helper: get loss at offset from boresight (wraps around 360)
  function lossAt(offset: number): number {
    const a = ((boresight + offset) % 360 + 360) % 360;
    return loss[a];
  }

  // Interpolate the fractional offset where loss crosses threshold
  function interpolate(offsetBefore: number, offsetAfter: number): number {
    const lossBefore = lossAt(offsetBefore);
    const lossAfter = lossAt(offsetAfter);
    const range = lossAfter - lossBefore;
    if (Math.abs(range) < 1e-9) return offsetAfter;
    const frac = (thresholddB - lossBefore) / range;
    return offsetBefore + frac * (offsetAfter - offsetBefore);
  }

  // Search clockwise (positive offsets 1, 2, 3...)
  let rightEdge: number | null = null;
  for (let off = 1; off <= 180; off++) {
    const l = lossAt(off);
    if (isNaN(l)) continue;
    if (l >= thresholddB) {
      rightEdge = interpolate(off - 1, off);
      break;
    }
  }

  // Search counter-clockwise (negative offsets -1, -2, -3...)
  let leftEdge: number | null = null;
  for (let off = -1; off >= -180; off--) {
    const l = lossAt(off);
    if (isNaN(l)) continue;
    if (l >= thresholddB) {
      leftEdge = interpolate(off + 1, off);
      break;
    }
  }

  if (rightEdge === null || leftEdge === null) return null;

  const bw = rightEdge - leftEdge;
  if (bw <= 0 || bw > 360) return null;

  return Math.round(bw * 10) / 10;
}

export function computeBeamwidths(pattern: PatternPoint[]): BeamwidthResult {
  return {
    bw3dB: calculateBeamwidth(pattern, 3),
    bw10dB: calculateBeamwidth(pattern, 10),
  };
}
