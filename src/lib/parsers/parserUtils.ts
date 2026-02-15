import type { MsiMetadata, PatternPoint } from '../../types/msi';

export function createEmptyMetadata(): MsiMetadata {
  return {
    name: '',
    make: '',
    frequency: '',
    gain: '',
    hWidth: '',
    vWidth: '',
    frontToBack: '',
    tilt: '',
    electricalTilt: '',
    polarization: '',
    comment: '',
    extra: {},
  };
}

export function normalizeToLoss(points: PatternPoint[]): PatternPoint[] {
  if (points.length === 0) return points;
  const minVal = Math.min(...points.map(p => p.lossdB));
  if (minVal >= 0) return points;
  const maxVal = Math.max(...points.map(p => p.lossdB));
  return points.map(p => ({
    angleDeg: p.angleDeg,
    lossdB: maxVal - p.lossdB,
  }));
}
