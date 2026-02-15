import type { PatternPoint, MsiFile, MsiMetadata } from '../types/msi';

/** Build a 360-element Float64Array of loss values indexed by angle (0-359). */
export function buildLossArray(pattern: PatternPoint[]): Float64Array {
  const loss = new Float64Array(360).fill(NaN);
  for (const p of pattern) {
    const a = ((Math.round(p.angleDeg) % 360) + 360) % 360;
    loss[a] = p.lossdB;
  }
  return loss;
}

/** Convert a 360-element loss array back to PatternPoint[]. */
export function lossArrayToPoints(loss: Float64Array): PatternPoint[] {
  const points: PatternPoint[] = [];
  for (let a = 0; a < 360; a++) {
    if (!isNaN(loss[a])) {
      points.push({ angleDeg: a, lossdB: loss[a] });
    }
  }
  return points;
}

/** Create a synthetic MsiFile from patterns and source files. */
export function createSyntheticFile(
  horizontal: PatternPoint[],
  vertical: PatternPoint[],
  name: string,
  color: string,
  sourceFileIds: string[],
  extraMeta?: Partial<MsiMetadata>,
): MsiFile {
  return {
    id: crypto.randomUUID(),
    fileName: name,
    metadata: {
      name,
      make: '',
      frequency: extraMeta?.frequency ?? '',
      gain: extraMeta?.gain ?? '',
      hWidth: '',
      vWidth: '',
      frontToBack: '',
      tilt: extraMeta?.tilt ?? '',
      electricalTilt: extraMeta?.electricalTilt ?? '',
      polarization: '',
      comment: 'Synthetic pattern',
      extra: {},
    },
    horizontal,
    vertical,
    color,
    visible: true,
    synthetic: true,
    sourceFileIds,
  };
}
