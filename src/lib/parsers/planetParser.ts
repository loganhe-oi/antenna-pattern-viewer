import type { MsiFile, PatternPoint } from '../../types/msi';
import { createEmptyMetadata, normalizeToLoss } from './parserUtils';

/**
 * Parse Planet (.pla/.pln) antenna pattern files.
 *
 * Format: Similar to MSI but uses PLANET_FORMAT marker.
 * Header key-value pairs followed by HORIZONTAL and VERTICAL sections
 * with angle-value data lines.
 */
export function parsePlanetFile(content: string, fileName: string, color: string): MsiFile {
  const lines = content.split(/\r?\n/);
  const metadata = createEmptyMetadata();
  const horizontal: PatternPoint[] = [];
  const vertical: PatternPoint[] = [];

  type Section = 'header' | 'horizontal' | 'vertical';
  let section: Section = 'header';

  const keyMap: Record<string, string> = {
    NAME: 'name',
    MAKE: 'make',
    FREQUENCY: 'frequency',
    GAIN: 'gain',
    H_WIDTH: 'hWidth',
    W_WIDTH: 'hWidth',
    V_WIDTH: 'vWidth',
    FRONT_TO_BACK: 'frontToBack',
    TILT: 'tilt',
    ELECTRICAL_TILT: 'electricalTilt',
    POLARIZATION: 'polarization',
    COMMENT: 'comment',
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.toUpperCase() === 'PLANET_FORMAT') continue;

    if (/^HORIZONTAL\b/i.test(line)) {
      section = 'horizontal';
      continue;
    }
    if (/^VERTICAL\b/i.test(line)) {
      section = 'vertical';
      continue;
    }

    if (section === 'header') {
      const match = line.match(/^(\S+)\s+(.*)$/);
      if (match) {
        const [, key, value] = match;
        const field = keyMap[key.toUpperCase()];
        if (field) {
          (metadata as unknown as Record<string, string>)[field] = value.trim();
        } else {
          metadata.extra[key] = value.trim();
        }
      }
    } else {
      const parts = line.split(/[\s\t]+/);
      if (parts.length >= 2) {
        const angle = parseFloat(parts[0]);
        const value = parseFloat(parts[1]);
        if (!isNaN(angle) && !isNaN(value)) {
          (section === 'horizontal' ? horizontal : vertical).push({
            angleDeg: angle,
            lossdB: value,
          });
        }
      }
    }
  }

  if (!metadata.name) metadata.name = fileName.replace(/\.(pla|pln)$/i, '');

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
