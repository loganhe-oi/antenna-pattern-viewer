import type { MsiFile } from '../types/msi';
import { buildLossArray, lossArrayToPoints, createSyntheticFile } from './patternUtils';

/**
 * Compute the envelope (maximum gain / minimum loss at each angle)
 * across multiple antenna files.
 */
export function computeEnvelope(files: MsiFile[], color: string): MsiFile {
  const hArrays = files.map(f => buildLossArray(f.horizontal));
  const vArrays = files.map(f => buildLossArray(f.vertical));

  const hEnv = new Float64Array(360);
  const vEnv = new Float64Array(360);

  for (let a = 0; a < 360; a++) {
    let hMin = Infinity;
    let vMin = Infinity;
    for (let i = 0; i < files.length; i++) {
      if (!isNaN(hArrays[i][a])) hMin = Math.min(hMin, hArrays[i][a]);
      if (!isNaN(vArrays[i][a])) vMin = Math.min(vMin, vArrays[i][a]);
    }
    hEnv[a] = hMin === Infinity ? NaN : hMin;
    vEnv[a] = vMin === Infinity ? NaN : vMin;
  }

  const sourceIds = files.map(f => f.id);
  const names = files.map(f => f.metadata.name || f.fileName);
  const displayName = `Envelope (${names.length} antennas)`;

  return createSyntheticFile(
    lossArrayToPoints(hEnv),
    lossArrayToPoints(vEnv),
    displayName,
    color,
    sourceIds,
  );
}
