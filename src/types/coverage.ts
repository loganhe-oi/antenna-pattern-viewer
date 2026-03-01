export type EnvironmentType = 'urban' | 'suburban' | 'open';

export interface CoverageParams {
  antennaHeight: number;       // meters
  txPower: number;             // dBm
  environmentType: EnvironmentType;
  receiveThreshold: number;    // dBm
  mobileHeight: number;        // meters
}

export interface BeamProjectionResult {
  centerDistance: number;       // meters
  innerEdge: number;            // meters
  outerEdge: number;            // meters
  sectorWidth: number;          // meters (arc at center distance)
  downtiltUsed: number;         // degrees
  vBeamwidthUsed: number;       // degrees
  hBeamwidthUsed: number;       // degrees
}

export interface FsplResult {
  maxRange: number;             // km
  fsplAtMaxRange: number;       // dB
  effectiveGain: number;        // dBi used
  frequencyMHz: number;         // MHz used
}

export interface CostHataResult {
  maxRange: number;             // km
  pathLossAtMaxRange: number;   // dB
  environmentCorrection: number; // Cm value (dB)
  mobileCorrection: number;     // a(hm) value (dB)
  frequencyMHz: number;
  valid: boolean;               // false if freq outside 1500-2000 MHz
  validationMessage?: string;
}

export const DEFAULT_COVERAGE_PARAMS: CoverageParams = {
  antennaHeight: 30,
  txPower: 43,
  environmentType: 'urban',
  receiveThreshold: -100,
  mobileHeight: 1.5,
};

export interface CoverageAreaResult {
  innerRadius: number;          // km
  outerRadius: number;          // km
  sectorAngle: number;          // degrees (horizontal beamwidth)
  sectorArea: number;           // km²
  propagationLimitedRadius: number; // km
  geometryLimitedRadius: number;    // km
}
