import type { PatternPoint, PatternAdjustments, MsiFile } from '../types/msi';
import { buildLossArray, lossArrayToPoints } from './patternUtils';

/**
 * Linearly interpolate a value from a 360-element loss array at a fractional angle.
 */
function sampleLoss(loss: Float64Array, angleDeg: number): number {
  const a = ((angleDeg % 360) + 360) % 360;
  const lo = Math.floor(a);
  const hi = (lo + 1) % 360;
  const frac = a - lo;
  const vLo = isNaN(loss[lo]) ? 0 : loss[lo];
  const vHi = isNaN(loss[hi]) ? 0 : loss[hi];
  return vLo + frac * (vHi - vLo);
}

/**
 * Shift a pattern by a given number of degrees using circular interpolation.
 * Positive shiftDeg moves the beam peak to a higher angle
 * (clockwise on a CW polar chart).
 */
function shiftPattern(loss: Float64Array, shiftDeg: number): Float64Array {
  if (Math.abs(shiftDeg) < 0.01) return loss;
  const result = new Float64Array(360);
  for (let a = 0; a < 360; a++) {
    result[a] = sampleLoss(loss, a - shiftDeg);
  }
  return result;
}

/**
 * Linearly interpolate between two 360-element loss arrays.
 */
function blendPatterns(
  lossA: Float64Array,
  lossB: Float64Array,
  fraction: number,
): Float64Array {
  const result = new Float64Array(360);
  for (let i = 0; i < 360; i++) {
    const a = isNaN(lossA[i]) ? 0 : lossA[i];
    const b = isNaN(lossB[i]) ? 0 : lossB[i];
    result[i] = a + fraction * (b - a);
  }
  return result;
}

/**
 * Normalize a pattern so the minimum loss (peak gain) is exactly 0 dB.
 * This ensures the pattern always touches the outer ring of the polar plot.
 */
function normalizePoints(points: PatternPoint[]): PatternPoint[] {
  let minLoss = Infinity;
  for (const p of points) {
    if (p.lossdB < minLoss) minLoss = p.lossdB;
  }
  if (!isFinite(minLoss) || Math.abs(minLoss) < 0.001) return points;
  return points.map(p => ({ angleDeg: p.angleDeg, lossdB: p.lossdB - minLoss }));
}

// ─── Electrical Tilt: Pattern Interpolation ─────────────────────────

interface FamilyMember {
  file: MsiFile;
  tilt: number;
}

/**
 * Extract electrical tilt value from a file.
 * Tries metadata first, then common filename patterns.
 */
function extractTilt(file: MsiFile): number | null {
  // Metadata (most reliable)
  const metaTilt = parseFloat(file.metadata.electricalTilt);
  if (!isNaN(metaTilt)) return metaTilt;

  // Filename patterns: _02T, T02P, _T02, Tilt2, etc.
  const patterns = [
    /_(\d+(?:\.\d+)?)T(?:\b|_|P|$)/i,
    /T(\d+(?:\.\d+)?)P\d/i,
    /_T(\d+(?:\.\d+)?)/i,
    /Tilt[_ ]?(\d+(?:\.\d+)?)/i,
  ];
  for (const pat of patterns) {
    const m = file.fileName.match(pat);
    if (m) return parseFloat(m[1]);
  }
  return null;
}

/**
 * Derive a family key by stripping tilt-related parts from the filename.
 * Files with the same key belong to the same antenna family.
 */
function getFamilyKey(file: MsiFile): string {
  let name = file.fileName;
  // Strip tilt suffixes
  name = name.replace(/_\d+(?:\.\d+)?T(?=\b|_|P|$)/gi, '_');
  name = name.replace(/T\d+(?:\.\d+)?P(\d)/gi, 'P$1');
  name = name.replace(/_T\d+(?:\.\d+)?/gi, '_');
  name = name.replace(/Tilt[_ ]?\d+(?:\.\d+)?/gi, '');
  // Normalize
  name = name.replace(/_+/g, '_').replace(/^_|_$/g, '');
  return name.trim().toLowerCase();
}

/**
 * Apply electrical tilt delta using pattern interpolation between family members.
 *
 * Given the current file's tilt and a delta, finds two bracketing family members
 * (files with the same antenna but different tilt values) and linearly interpolates
 * the vertical pattern between them degree-by-degree.
 *
 * Returns interpolated horizontal and vertical patterns, or null if family
 * interpolation isn't possible.
 */
export function applyElectricalTiltInterpolation(
  allFiles: MsiFile[],
  currentFile: MsiFile,
  tiltDelta: number,
): { horizontal: PatternPoint[]; vertical: PatternPoint[] } | null {
  if (Math.abs(tiltDelta) < 0.01) return null;

  const currentTilt = extractTilt(currentFile);
  if (currentTilt === null) return null;

  const targetTilt = currentTilt + tiltDelta;
  const familyKey = getFamilyKey(currentFile);

  // Collect family members (loaded files with same base name + known tilt)
  const members: FamilyMember[] = [];
  for (const f of allFiles) {
    if (getFamilyKey(f) !== familyKey) continue;
    const tilt = extractTilt(f);
    if (tilt !== null) {
      members.push({ file: f, tilt });
    }
  }

  if (members.length < 2) return null;

  // Sort by tilt ascending
  members.sort((a, b) => a.tilt - b.tilt);

  // Find bracketing pair
  let lower: FamilyMember | null = null;
  let upper: FamilyMember | null = null;

  for (const m of members) {
    if (m.tilt <= targetTilt) lower = m;
    if (m.tilt >= targetTilt && !upper) upper = m;
  }

  // Clamp to extremes if target is outside range
  if (!lower) lower = members[0];
  if (!upper) upper = members[members.length - 1];

  // Exact match or same bracket
  if (lower.tilt === upper.tilt) {
    return {
      horizontal: lower.file.horizontal,
      vertical: lower.file.vertical,
    };
  }

  const fraction = (targetTilt - lower.tilt) / (upper.tilt - lower.tilt);

  // Interpolate both horizontal and vertical patterns between family members
  const hLossA = buildLossArray(lower.file.horizontal);
  const hLossB = buildLossArray(upper.file.horizontal);
  const vLossA = buildLossArray(lower.file.vertical);
  const vLossB = buildLossArray(upper.file.vertical);

  return {
    horizontal: lossArrayToPoints(blendPatterns(hLossA, hLossB, fraction)),
    vertical: lossArrayToPoints(blendPatterns(vLossA, vLossB, fraction)),
  };
}

// ─── Azimuth Rotation ───────────────────────────────────────────────

/** Apply azimuth rotation to horizontal pattern (circular shift). */
export function applyAzimuthRotation(
  horizontal: PatternPoint[],
  deg: number,
): PatternPoint[] {
  if (Math.abs(deg) < 0.01) return horizontal;
  const loss = buildLossArray(horizontal);
  // Positive deg → beam rotates clockwise on the H polar chart (rotation: 90)
  return lossArrayToPoints(shiftPattern(loss, deg));
}

// ─── Combined Adjustments ───────────────────────────────────────────

/**
 * Apply all adjustments to a file's patterns.
 *
 * Strict separation of concerns:
 *
 *  Horizontal chart — Elec. Tilt interpolates the H beam shape between
 *    family members (different tilt files have different H patterns too).
 *    Azimuth rotation is handled visually by the chart components.
 *
 *  Vertical chart — two independent steps:
 *    1. Shape:    Elec. Tilt interpolates the V beam shape between family members.
 *    2. Steering: The V data is shifted by the total tilt angle
 *                 (Mech_Downtilt + Base_Elec_Tilt + Elec_Tilt_Delta)
 *                 so the beam appears at the correct elevation on the chart.
 *                 Raw antenna files normalize their peak to 0°, so this shift
 *                 is required to visually position the beam.
 *
 *  Both patterns are normalized to 0 dB so the outer ring is always touched.
 */
export function applyAdjustments(
  horizontal: PatternPoint[],
  vertical: PatternPoint[],
  adj: PatternAdjustments,
  allFiles?: MsiFile[],
  currentFile?: MsiFile,
): { horizontal: PatternPoint[]; vertical: PatternPoint[] } {
  let h = horizontal;
  let v = vertical;

  // ── Electrical tilt interpolation (H + V) ──────────────────────────
  // Interpolates both beam shapes between family members.
  // No fallback shift — visual steering (below) handles beam positioning.
  if (adj.electricalTiltDelta !== 0 && allFiles && currentFile) {
    const interpolated = applyElectricalTiltInterpolation(
      allFiles,
      currentFile,
      adj.electricalTiltDelta,
    );
    if (interpolated) {
      h = interpolated.horizontal;
      v = interpolated.vertical;
    }
  }

  // ── Angular positioning (V steering + H azimuth) is handled visually
  // by the chart components using per-file theta offsets, NOT by shifting
  // the data arrays here. This keeps the loss data in its original angular
  // frame so that interpolation and normalization operate correctly.

  // ── Normalize both to 0 dB ────────────────────────────────────────
  h = normalizePoints(h);
  v = normalizePoints(v);

  return { horizontal: h, vertical: v };
}
