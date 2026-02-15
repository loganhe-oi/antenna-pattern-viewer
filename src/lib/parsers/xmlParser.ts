import type { MsiFile, PatternPoint } from '../../types/msi';
import { createEmptyMetadata } from './parserUtils';
import { PLOT_COLORS } from '../../constants/plotColors';

/**
 * Parse Atoll Enterprise XML v3 antenna pattern files.
 *
 * Structure: ANTENNA-LIST > ANTENNA > BEAM-PATTERN-LIST > BEAM-PATTERN*
 * Each BEAM-PATTERN has metadata elements + H-MASK-LIST and V-MASK-LIST
 * with <M>angle,loss</M> entries (360 points, loss in dB).
 * A single file may contain multiple beam patterns (different tilts).
 */
export function parseXmlFile(content: string, fileName: string): MsiFile[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');
  const results: MsiFile[] = [];

  // Find all BEAM-PATTERN elements
  const beamPatterns = doc.getElementsByTagName('BEAM-PATTERN');

  for (let i = 0; i < beamPatterns.length; i++) {
    const bp = beamPatterns[i];
    const metadata = createEmptyMetadata();

    // Extract metadata from child elements
    metadata.name = getElementText(bp, 'DESCRIPTION') || getElementText(bp, 'ID') || `Pattern ${i + 1}`;
    metadata.electricalTilt = getElementText(bp, 'ELEC-TILT');
    metadata.hWidth = getElementText(bp, 'HORIZONTAL-BW').trim();
    metadata.vWidth = getElementText(bp, 'VERTICAL-BW').trim();
    metadata.gain = getElementText(bp, 'GAIN');
    metadata.frequency = getElementText(bp, 'FREQUENCY').trim();
    metadata.frontToBack = getElementText(bp, 'FRONT-TO-BACK').trim();
    metadata.polarization = getElementText(bp, 'POLARISATION');
    metadata.tilt = getElementText(bp, 'TILE-TYPE');

    // Gain type (dBd vs dBi)
    const gainType = getElementText(bp, 'GAIN-TYPE');
    if (gainType) {
      metadata.extra['Gain Type'] = gainType;
    }

    // Get antenna-level metadata from parent
    const antenna = bp.closest?.('ANTENNA') ?? bp.parentElement?.parentElement;
    if (antenna) {
      metadata.make = getElementText(antenna, 'MANUFACTURER');
      const antennaId = antenna.getAttribute('ID');
      if (antennaId) metadata.extra['Antenna ID'] = antennaId;
    }

    // Parse H pattern
    const horizontal = parseMaskList(bp, 'H-MASK-LIST');
    const vertical = parseMaskList(bp, 'V-MASK-LIST');

    const color = PLOT_COLORS[results.length % PLOT_COLORS.length];

    results.push({
      id: crypto.randomUUID(),
      fileName: `${fileName} — ${metadata.name}`,
      metadata,
      horizontal,
      vertical,
      color,
      visible: results.length < 1, // only first visible by default
    });
  }

  return results;
}

function getElementText(parent: Element, tagName: string): string {
  const el = parent.getElementsByTagName(tagName)[0];
  return el?.textContent?.trim() ?? '';
}

function parseMaskList(beamPattern: Element, listTagName: string): PatternPoint[] {
  const list = beamPattern.getElementsByTagName(listTagName)[0];
  if (!list) return [];

  const points: PatternPoint[] = [];
  const mElements = list.getElementsByTagName('M');

  for (let i = 0; i < mElements.length; i++) {
    const text = mElements[i].textContent?.trim();
    if (!text) continue;
    const parts = text.split(',');
    if (parts.length < 2) continue;
    const angle = parseFloat(parts[0]);
    const loss = parseFloat(parts[1]);
    if (!isNaN(angle) && !isNaN(loss)) {
      points.push({ angleDeg: angle, lossdB: loss });
    }
  }

  return points;
}
