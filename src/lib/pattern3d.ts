import type { PatternPoint } from '../types/msi';
import { buildLossArray } from './patternUtils';

export interface Surface3DData {
  x: number[][];
  y: number[][];
  z: number[][];
  surfacecolor: number[][];
}

export interface Wireframe3DData {
  x: number[];
  y: number[];
  z: number[];
  color: number[];
}

/** Dynamic range for 3D visualization (dB). */
const DYNAMIC_RANGE = 40;

interface Adjustments3D {
  azimuthRotation?: number;
  mechDowntilt?: number;
  totalElecTilt?: number;
}

/**
 * Generate 3D surface data for a single antenna.
 *
 * RF coordinate convention:
 *   - Azimuth 0° = North (+Y), positive azimuth rotates CW toward East (+X)
 *   - Elevation 0° = Horizon (XY plane), positive elevation = downtilt (−Z)
 *   - V pattern data index 0 = boresight (horizon), so trueElevation = elIdx directly
 *
 * Steps:
 *   1. Pre-build synthesized 3D gain array: gainArray[az][el] = −(hLoss + vLoss)
 *   2. Find absolute true peak with explicit nested loop
 *   3. Normalize, clamp, compute radius and RF Cartesian coordinates
 */
export function generateSurface3D(
  horizontal: PatternPoint[],
  vertical: PatternPoint[],
  resolution = 2,
  adjustments?: Adjustments3D,
): Surface3DData {
  const hLoss = buildLossArray(horizontal);
  const vLoss = buildLossArray(vertical);

  const azRotation = adjustments?.azimuthRotation ?? 0;
  const mechTilt = adjustments?.mechDowntilt ?? 0;
  const elecTilt = adjustments?.totalElecTilt ?? 0;

  // ── Pre-build synthesized 3D gain array: gainArray[az][el] ──
  const gainArray: number[][] = [];
  for (let az = 0; az < 360; az++) {
    const lh = isNaN(hLoss[az]) ? 0 : hLoss[az];
    const row: number[] = [];
    for (let el = 0; el < 360; el++) {
      const lv = isNaN(vLoss[el]) ? 0 : vLoss[el];
      row.push(-(lh + lv));
    }
    gainArray.push(row);
  }

  // ── Step 1: Safely find the absolute true peak inside the nested array ──
  let trueMaxGain = -Infinity;
  for (let i = 0; i < gainArray.length; i++) {
    for (let j = 0; j < gainArray[i].length; j++) {
      const val = gainArray[i][j];
      if (typeof val === 'number' && val > trueMaxGain) {
        trueMaxGain = val;
      }
    }
  }

  // ── Step 2: Build the Plotly surface with correct lookups ──
  const x: number[][] = [];
  const y: number[][] = [];
  const z: number[][] = [];
  const surfacecolor: number[][] = [];

  // Loop to <= 360 to perfectly close the 3D sphere
  for (let elIdx = 0; elIdx <= 360; elIdx += resolution) {
    const xRow: number[] = [];
    const yRow: number[] = [];
    const zRow: number[] = [];
    const colorRow: number[] = [];

    // Elevation: index 0 = horizon (boresight). No −90 offset needed.
    const trueElevation = elIdx + mechTilt + elecTilt;
    const elRad = trueElevation * (Math.PI / 180);

    for (let azIdx = 0; azIdx <= 360; azIdx += resolution) {
      const trueAzimuth = (azIdx + azRotation) % 360;
      const azRad = trueAzimuth * (Math.PI / 180);

      // FIX TRANSPOSED AXES: gainArray[azIdx][elIdx]
      // 58° H-width maps to azimuth, 5° V-width maps to elevation
      const rawGain = gainArray[azIdx % 360][elIdx % 360];

      // STRICT NORMALIZATION: Peak is EXACTLY 0 dB (Pure Red)
      const normalizedGain = rawGain - trueMaxGain;

      // Clamp physical shape to dynamic range
      const shapeGain = Math.max(normalizedGain, -DYNAMIC_RANGE);
      const radius = shapeGain + DYNAMIC_RANGE; // Peak = 40, −40 dB = 0

      // Geographic RF Cartesian Mapping (unchanged)
      xRow.push(radius * Math.cos(elRad) * Math.sin(azRad));
      yRow.push(radius * Math.cos(elRad) * Math.cos(azRad));
      zRow.push(radius * Math.sin(-elRad));

      // Color = un-clamped normalizedGain so legend is accurate
      colorRow.push(normalizedGain);
    }

    x.push(xRow);
    y.push(yRow);
    z.push(zRow);
    surfacecolor.push(colorRow);
  }

  return { x, y, z, surfacecolor };
}

/**
 * Generate 3D wireframe data for multi-antenna scatter3d overlay.
 * Returns principal H plane (horizon cut) and V plane (boresight cut).
 * Same RF coordinate convention and normalization as generateSurface3D.
 */
export function generate3DWireframe(
  horizontal: PatternPoint[],
  vertical: PatternPoint[],
  adjustments?: Adjustments3D,
): Wireframe3DData {
  const hLoss = buildLossArray(horizontal);
  const vLoss = buildLossArray(vertical);

  const azRotation = adjustments?.azimuthRotation ?? 0;
  const mechTilt = adjustments?.mechDowntilt ?? 0;
  const elecTilt = adjustments?.totalElecTilt ?? 0;

  // V pattern index 0 = horizon (boresight)
  const vLoss0 = isNaN(vLoss[0]) ? 0 : vLoss[0];
  const hLoss0 = isNaN(hLoss[0]) ? 0 : hLoss[0];

  // ── Collect raw gains for both planes ──
  const hPlaneGains: number[] = [];
  for (let az = 0; az < 360; az++) {
    const lh = isNaN(hLoss[az]) ? 0 : hLoss[az];
    hPlaneGains.push(-(lh + vLoss0));
  }

  const vPlaneGains: number[] = [];
  for (let el = 0; el < 360; el++) {
    const lv = isNaN(vLoss[el]) ? 0 : vLoss[el];
    vPlaneGains.push(-(lv + hLoss0));
  }

  // ── Find peak across both planes ──
  let maxGain = -Infinity;
  for (const g of hPlaneGains) if (g > maxGain) maxGain = g;
  for (const g of vPlaneGains) if (g > maxGain) maxGain = g;

  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  const color: number[] = [];

  // ── H plane: elIdx=0 (horizon), azimuth varies ──
  const hElev = 0 + mechTilt + elecTilt;
  const hElRad = hElev * (Math.PI / 180);
  for (let azIdx = 0; azIdx < 360; azIdx++) {
    const normalizedGain = hPlaneGains[azIdx] - maxGain;
    const shapeGain = Math.max(normalizedGain, -DYNAMIC_RANGE);
    const radius = shapeGain + DYNAMIC_RANGE;

    const trueAzimuth = (azIdx + azRotation) % 360;
    const azRad = trueAzimuth * (Math.PI / 180);

    x.push(radius * Math.cos(hElRad) * Math.sin(azRad));
    y.push(radius * Math.cos(hElRad) * Math.cos(azRad));
    z.push(radius * Math.sin(-hElRad));
    color.push(normalizedGain);
  }

  // ── V plane: azIdx=0 (North), elevation varies ──
  const vAz = (0 + azRotation) % 360;
  const vAzRad = vAz * (Math.PI / 180);
  for (let elIdx = 0; elIdx < 360; elIdx++) {
    const normalizedGain = vPlaneGains[elIdx] - maxGain;
    const shapeGain = Math.max(normalizedGain, -DYNAMIC_RANGE);
    const radius = shapeGain + DYNAMIC_RANGE;

    const trueElevation = elIdx + mechTilt + elecTilt;
    const elRad = trueElevation * (Math.PI / 180);

    x.push(radius * Math.cos(elRad) * Math.sin(vAzRad));
    y.push(radius * Math.cos(elRad) * Math.cos(vAzRad));
    z.push(radius * Math.sin(-elRad));
    color.push(normalizedGain);
  }

  return { x, y, z, color };
}
