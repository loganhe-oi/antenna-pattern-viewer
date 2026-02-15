import type { MsiFile, PatternPoint } from '../types/msi';
import { buildLossArray, lossArrayToPoints, createSyntheticFile } from './patternUtils';

/**
 * Linearly interpolate between two patterns at each angle.
 * t=0 gives fileA's pattern, t=1 gives fileB's pattern.
 */
function interpolateArrays(
  patternsA: PatternPoint[],
  patternsB: PatternPoint[],
  t: number,
): PatternPoint[] {
  const lossA = buildLossArray(patternsA);
  const lossB = buildLossArray(patternsB);
  const result = new Float64Array(360);

  for (let a = 0; a < 360; a++) {
    const va = isNaN(lossA[a]) ? 0 : lossA[a];
    const vb = isNaN(lossB[a]) ? 0 : lossB[a];
    result[a] = va + t * (vb - va);
  }

  return lossArrayToPoints(result);
}

export type InterpolationParam = 'tilt' | 'frequency';

/**
 * Interpolate between two antenna files parameterized by tilt or frequency.
 */
export function interpolatePatterns(
  fileA: MsiFile,
  fileB: MsiFile,
  param: InterpolationParam,
  targetValue: number,
  color: string,
): MsiFile | null {
  let valueA: number;
  let valueB: number;

  if (param === 'tilt') {
    valueA = parseFloat(fileA.metadata.electricalTilt) || 0;
    valueB = parseFloat(fileB.metadata.electricalTilt) || 0;
  } else {
    valueA = parseFloat(fileA.metadata.frequency) || 0;
    valueB = parseFloat(fileB.metadata.frequency) || 0;
  }

  const range = valueB - valueA;
  if (Math.abs(range) < 1e-9) return null;

  const t = (targetValue - valueA) / range;

  const horizontal = interpolateArrays(fileA.horizontal, fileB.horizontal, t);
  const vertical = interpolateArrays(fileA.vertical, fileB.vertical, t);

  const paramLabel = param === 'tilt' ? 'Tilt' : 'Freq';
  const displayName = `Interpolated ${paramLabel}=${targetValue}`;

  return createSyntheticFile(
    horizontal,
    vertical,
    displayName,
    color,
    [fileA.id, fileB.id],
    {
      electricalTilt: param === 'tilt' ? String(targetValue) : '',
      frequency: param === 'frequency' ? String(targetValue) : '',
    },
  );
}
