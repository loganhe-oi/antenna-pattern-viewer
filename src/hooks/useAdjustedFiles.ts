import { useMemo } from 'react';
import type { MsiFile, PatternAdjustments } from '../types/msi';
import { applyAdjustments } from '../lib/patternTransform';

const ZERO_ADJ: PatternAdjustments = {
  mechanicalDowntilt: 0,
  electricalTiltDelta: 0,
  azimuthRotation: 0,
};

/**
 * Apply per-file adjustments (tilt, rotation) to produce new pattern arrays
 * without mutating originals.
 *
 * Also applies V visual steering for files with a base electrical tilt,
 * even when no user adjustments are set — this positions the beam at
 * the correct elevation on the Vertical chart.
 *
 * @param files    Files to adjust (typically the filtered list)
 * @param allFiles All loaded files (needed for electrical tilt family interpolation)
 */
export function useAdjustedFiles(files: MsiFile[], allFiles: MsiFile[]): MsiFile[] {
  return useMemo(() => {
    return files.map(file => {
      const adj = file.adjustments ?? ZERO_ADJ;

      // Only process if electrical tilt delta is non-zero (needs V shape interpolation).
      // Angular positioning (mech downtilt, azimuth, base tilt) is handled visually
      // by the chart components, not by data array shifts.
      if (adj.electricalTiltDelta === 0) return file;

      const { horizontal, vertical } = applyAdjustments(
        file.horizontal,
        file.vertical,
        adj,
        allFiles,
        file,
      );

      return { ...file, horizontal, vertical };
    });
  }, [files, allFiles]);
}
