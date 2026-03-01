import { useMemo } from 'react';
import type { MsiFile } from '../types/msi';
import type {
  CoverageParams,
  BeamProjectionResult,
  FsplResult,
  CostHataResult,
  CoverageAreaResult,
} from '../types/coverage';
import { computeBeamwidths } from '../lib/beamwidth';
import {
  computeBeamProjection,
  computeFsplRange,
  computeCostHata,
  computeCoverageArea,
} from '../lib/coverageModels';

export interface CoverageResults {
  beam: BeamProjectionResult | null;
  fspl: FsplResult | null;
  hata: CostHataResult | null;
  area: CoverageAreaResult | null;
  freq: number;
  gain: number;
  vBW: number;
  hBW: number;
  totalDowntilt: number;
}

export function useCoverageResults(
  file: MsiFile | null,
  params: CoverageParams,
): CoverageResults | null {
  return useMemo(() => {
    if (!file) return null;

    const freq = parseFloat(file.metadata.frequency) || 0;
    const gain = parseFloat(file.metadata.gain) || 0;

    const metaVBW = parseFloat(file.metadata.vWidth);
    const metaHBW = parseFloat(file.metadata.hWidth);
    const computed = computeBeamwidths(file.vertical);
    const computedH = computeBeamwidths(file.horizontal);
    const vBW = (metaVBW > 0 ? metaVBW : computed.bw3dB) || 0;
    const hBW = (metaHBW > 0 ? metaHBW : computedH.bw3dB) || 0;

    const baseTilt = parseFloat(file.metadata.tilt) || 0;
    const mechTilt = file.adjustments?.mechanicalDowntilt ?? 0;
    const totalDowntilt = baseTilt + mechTilt;

    const beam = computeBeamProjection(params.antennaHeight, totalDowntilt, vBW, hBW);

    const fspl = freq > 0
      ? computeFsplRange(freq, params.txPower, gain, params.receiveThreshold)
      : null;

    const hata = freq > 0
      ? computeCostHata(freq, params.antennaHeight, params.mobileHeight, params.txPower, gain, params.receiveThreshold, params.environmentType)
      : null;

    const propMaxRange = hata?.maxRange ?? fspl?.maxRange ?? null;
    const area = computeCoverageArea(beam, propMaxRange, hBW);

    return { beam, fspl, hata, area, freq, gain, vBW, hBW, totalDowntilt };
  }, [file, params]);
}
