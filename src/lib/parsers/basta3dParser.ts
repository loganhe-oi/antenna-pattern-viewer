import type { MsiFile, PatternPoint } from '../../types/msi';
import { createEmptyMetadata, normalizeToLoss } from './parserUtils';

/**
 * BASTA 3D radiation pattern JSON format (AA WP v3.0).
 *
 * Structure:
 * - Header metadata (Supplier, Antenna_Model, Gain, Frequency, etc.)
 * - Data_Set_Row_Structure: ["Theta", "Phi", "MagAttenuationCo", "MagAttenuationCr"]
 * - Data_Set: array of [theta, phi, co-pol attenuation, cross-pol attenuation]
 *   theta: -90 to +90 (elevation), phi: 0 to 359 (azimuth)
 *   Values are attenuation in dB (0 = max gain)
 *
 * For 2D views we extract:
 *   Horizontal pattern: theta=0, phi varies (azimuth cut)
 *   Vertical pattern: phi=0, theta varies (elevation cut, mapped to 0-359)
 */

interface Basta3dJson {
  BASTA_AA_WP_version?: string;
  Supplier?: string;
  Antenna_Model?: string;
  Antenna_Type?: string;
  Frequency?: { value: number; unit: string } | null;
  Gain?: { value: number; unit: string } | null;
  RF_Port?: string;
  Phi_HPBW?: number | null;
  Theta_HPBW?: number | null;
  Front_to_Back?: number | null;
  Theta_Electrical_Tilt?: number | null;
  Nominal_Polarization?: string | null;
  Optional_Comments?: string | null;
  Pattern_Name?: string | null;
  Data_Set_Row_Structure?: string[];
  Data_Set?: number[][];
}

export function parseBasta3dFile(content: string, fileName: string, color: string): MsiFile {
  const json: Basta3dJson = JSON.parse(content);
  const metadata = createEmptyMetadata();

  // Extract metadata
  metadata.make = json.Supplier ?? '';
  metadata.name = json.Pattern_Name || json.Antenna_Model || fileName.replace(/\.json$/i, '');
  metadata.frequency = json.Frequency?.value != null ? String(json.Frequency.value) : '';
  metadata.gain = json.Gain?.value != null ? String(json.Gain.value) : '';
  metadata.hWidth = json.Phi_HPBW != null ? String(json.Phi_HPBW) : '';
  metadata.vWidth = json.Theta_HPBW != null ? String(json.Theta_HPBW) : '';
  metadata.frontToBack = json.Front_to_Back != null ? String(json.Front_to_Back) : '';
  metadata.electricalTilt = json.Theta_Electrical_Tilt != null ? String(json.Theta_Electrical_Tilt) : '';
  metadata.polarization = json.Nominal_Polarization ?? '';
  metadata.comment = json.Optional_Comments ?? '';

  if (json.Gain?.unit) metadata.extra['Gain Unit'] = json.Gain.unit;
  if (json.RF_Port) metadata.extra['RF Port'] = json.RF_Port;
  if (json.Antenna_Type) metadata.extra['Antenna Type'] = json.Antenna_Type;
  if (json.BASTA_AA_WP_version) metadata.extra['BASTA Version'] = json.BASTA_AA_WP_version;

  // Determine column indices from Data_Set_Row_Structure
  const cols = json.Data_Set_Row_Structure ?? ['Theta', 'Phi', 'MagAttenuationCo', 'MagAttenuationCr'];
  const thetaIdx = cols.indexOf('Theta');
  const phiIdx = cols.indexOf('Phi');
  const coIdx = cols.indexOf('MagAttenuationCo');

  const dataSet = json.Data_Set ?? [];

  // Build lookup: Map<theta, Map<phi, attenuation>>
  // For horizontal: theta=0, phi=0..359
  // For vertical: phi=0, theta=-90..+90 → mapped to angle 0-359

  const horizontal: PatternPoint[] = [];
  const vertical: PatternPoint[] = [];

  // Collect horizontal cut (theta closest to 0)
  const hMap = new Map<number, number>();
  const vMap = new Map<number, number>();

  for (const row of dataSet) {
    const theta = row[thetaIdx];
    const phi = row[phiIdx];
    const atten = row[coIdx];

    if (theta === 0) {
      // Horizontal cut
      const existingH = hMap.get(phi);
      if (existingH === undefined || atten < existingH) {
        hMap.set(phi, atten);
      }
    }

    if (phi === 0) {
      // Vertical cut: map theta (-90..+90) to angle (0..359)
      // theta=0 → angle=0 (boresight)
      // theta>0 → angle=theta (downtilt direction)
      // theta<0 → angle=360+theta (uptilt direction)
      const angle = theta >= 0 ? theta : 360 + theta;
      const existingV = vMap.get(angle);
      if (existingV === undefined || atten < existingV) {
        vMap.set(angle, atten);
      }
    }
  }

  // Convert maps to sorted PatternPoint arrays
  for (const [phi, atten] of Array.from(hMap.entries()).sort((a, b) => a[0] - b[0])) {
    horizontal.push({ angleDeg: phi, lossdB: atten });
  }

  for (const [angle, atten] of Array.from(vMap.entries()).sort((a, b) => a[0] - b[0])) {
    vertical.push({ angleDeg: angle, lossdB: atten });
  }

  return {
    id: crypto.randomUUID(),
    fileName,
    metadata,
    horizontal: normalizeToLoss(horizontal),
    vertical: normalizeToLoss(vertical),
    color,
    visible: true,
  };
}
