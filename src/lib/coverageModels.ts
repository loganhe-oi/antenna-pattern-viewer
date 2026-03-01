import type {
  BeamProjectionResult,
  FsplResult,
  CostHataResult,
  CoverageAreaResult,
  EnvironmentType,
} from '../types/coverage';

const DEG2RAD = Math.PI / 180;
const MAX_DISTANCE_M = 50_000; // 50 km cap

/**
 * Geometric beam projection onto flat earth.
 *
 * Center distance = height / tan(downtilt)
 * Inner edge  = height / tan(downtilt + halfVBW)
 * Outer edge  = height / tan(downtilt - halfVBW)  (capped at 50 km)
 * Sector width = 2 * centerDist * tan(halfHBW)
 *
 * Returns null if downtilt <= 0 (beam at or above horizon).
 */
export function computeBeamProjection(
  antennaHeight: number,
  downtiltDeg: number,
  vBeamwidthDeg: number,
  hBeamwidthDeg: number,
): BeamProjectionResult | null {
  if (antennaHeight <= 0 || downtiltDeg <= 0 || vBeamwidthDeg <= 0 || hBeamwidthDeg <= 0) {
    return null;
  }

  const halfV = vBeamwidthDeg / 2;
  const halfH = hBeamwidthDeg / 2;

  const centerRad = downtiltDeg * DEG2RAD;
  const innerRad = (downtiltDeg + halfV) * DEG2RAD;
  const outerAngleDeg = downtiltDeg - halfV;

  const centerDistance = antennaHeight / Math.tan(centerRad);
  const innerEdge = antennaHeight / Math.tan(innerRad);

  let outerEdge: number;
  if (outerAngleDeg <= 0) {
    // Beam upper edge at or above horizon — extends to cap
    outerEdge = MAX_DISTANCE_M;
  } else {
    outerEdge = antennaHeight / Math.tan(outerAngleDeg * DEG2RAD);
    if (outerEdge > MAX_DISTANCE_M) outerEdge = MAX_DISTANCE_M;
  }

  const sectorWidth = 2 * centerDistance * Math.tan(halfH * DEG2RAD);

  return {
    centerDistance,
    innerEdge,
    outerEdge,
    sectorWidth,
    downtiltUsed: downtiltDeg,
    vBeamwidthUsed: vBeamwidthDeg,
    hBeamwidthUsed: hBeamwidthDeg,
  };
}

/**
 * Free-Space Path Loss max range.
 *
 * FSPL(dB) = 32.44 + 20*log10(f_MHz) + 20*log10(d_km)
 *
 * Link budget: txPower + gain - FSPL >= threshold
 * Max FSPL = txPower + gain - threshold
 * d_km = 10^((maxFSPL - 32.44 - 20*log10(f)) / 20)
 */
export function computeFsplRange(
  frequencyMHz: number,
  txPowerdBm: number,
  antennaGaindBi: number,
  receiveThresholddBm: number,
): FsplResult | null {
  if (frequencyMHz <= 0) return null;

  const maxPathLoss = txPowerdBm + antennaGaindBi - receiveThresholddBm;
  const logF = 20 * Math.log10(frequencyMHz);
  const distExponent = (maxPathLoss - 32.44 - logF) / 20;
  const maxRange = Math.pow(10, distExponent);

  if (!isFinite(maxRange) || maxRange <= 0) return null;

  const fsplAtMax = 32.44 + logF + 20 * Math.log10(maxRange);

  return {
    maxRange,
    fsplAtMaxRange: fsplAtMax,
    effectiveGain: antennaGaindBi,
    frequencyMHz,
  };
}

/**
 * COST-231 Hata model path loss and max range.
 *
 * PL = 46.3 + 33.9*log10(f) - 13.82*log10(hb) - a(hm)
 *      + (44.9 - 6.55*log10(hb))*log10(d) + Cm
 *
 * a(hm) for medium/small city:
 *   a(hm) = (1.1*log10(f) - 0.7)*hm - (1.56*log10(f) - 0.8)
 *
 * Cm: 0 dB for suburban/open, 3 dB for urban (metropolitan)
 *
 * Valid range: 1500-2000 MHz, hb 30-200m, hm 1-10m, d 1-20km
 */
export function computeCostHata(
  frequencyMHz: number,
  antennaHeight: number,
  mobileHeight: number,
  txPowerdBm: number,
  antennaGaindBi: number,
  receiveThresholddBm: number,
  environment: EnvironmentType,
): CostHataResult | null {
  if (frequencyMHz <= 0 || antennaHeight <= 0 || mobileHeight <= 0) return null;

  const f = frequencyMHz;
  const hb = antennaHeight;
  const hm = mobileHeight;

  // Mobile station antenna height correction (medium/small city)
  const logF = Math.log10(f);
  const aHm = (1.1 * logF - 0.7) * hm - (1.56 * logF - 0.8);

  // City size correction
  const Cm = environment === 'urban' ? 3 : 0;

  // Constant part of path loss (everything except distance term)
  const logHb = Math.log10(hb);
  const constant = 46.3 + 33.9 * logF - 13.82 * logHb - aHm + Cm;
  const slope = 44.9 - 6.55 * logHb;

  // Max allowable path loss from link budget
  const maxPathLoss = txPowerdBm + antennaGaindBi - receiveThresholddBm;

  // Solve: maxPathLoss = constant + slope * log10(d)
  // log10(d) = (maxPathLoss - constant) / slope
  const logD = (maxPathLoss - constant) / slope;
  const maxRange = Math.pow(10, logD);

  if (!isFinite(maxRange) || maxRange <= 0) return null;

  const pathLossAtMax = constant + slope * Math.log10(maxRange);

  // Validity check
  let valid = true;
  let validationMessage: string | undefined;
  const warnings: string[] = [];

  if (f < 1500 || f > 2000) {
    valid = false;
    warnings.push(`Freq ${f} MHz outside 1500-2000 MHz`);
  }
  if (hb < 30 || hb > 200) {
    warnings.push(`Antenna height ${hb}m outside 30-200m`);
  }
  if (hm < 1 || hm > 10) {
    warnings.push(`Mobile height ${hm}m outside 1-10m`);
  }

  if (warnings.length > 0) {
    valid = false;
    validationMessage = warnings.join('; ');
  }

  return {
    maxRange,
    pathLossAtMaxRange: pathLossAtMax,
    environmentCorrection: Cm,
    mobileCorrection: aHm,
    frequencyMHz: f,
    valid,
    validationMessage,
  };
}

/**
 * Combined coverage area estimation.
 *
 * Uses the minimum of geometry-limited and propagation-limited range
 * as the effective outer radius.
 *
 * Sector area = pi * (outerR^2 - innerR^2) * (sectorAngle / 360)
 */
export function computeCoverageArea(
  beamProjection: BeamProjectionResult | null,
  propagationMaxRangeKm: number | null,
  hBeamwidthDeg: number,
): CoverageAreaResult | null {
  if (!beamProjection && propagationMaxRangeKm == null) return null;

  const geometryOuterKm = beamProjection ? beamProjection.outerEdge / 1000 : Infinity;
  const geometryInnerKm = beamProjection ? beamProjection.innerEdge / 1000 : 0;
  const propRangeKm = propagationMaxRangeKm ?? Infinity;

  const outerRadius = Math.min(geometryOuterKm, propRangeKm);
  const innerRadius = Math.min(geometryInnerKm, outerRadius);

  if (!isFinite(outerRadius) || outerRadius <= 0) return null;

  const sectorAngle = hBeamwidthDeg > 0 ? hBeamwidthDeg : 360;
  const sectorArea =
    Math.PI * (outerRadius * outerRadius - innerRadius * innerRadius) * (sectorAngle / 360);

  return {
    innerRadius,
    outerRadius,
    sectorAngle,
    sectorArea,
    propagationLimitedRadius: isFinite(propRangeKm) ? propRangeKm : outerRadius,
    geometryLimitedRadius: isFinite(geometryOuterKm) ? geometryOuterKm : outerRadius,
  };
}
