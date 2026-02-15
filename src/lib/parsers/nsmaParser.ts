import type { MsiFile, PatternPoint } from '../../types/msi';
import { createEmptyMetadata, normalizeToLoss } from './parserUtils';

/**
 * Parse NSMA/ADF (WG-16.99.050) antenna pattern files.
 *
 * Format overview:
 * - Header with REVNUM, REVDATE, ANTMAN, MODNUM, etc.
 * - PATTYPE H/V sections with 360 pattern values
 * - Values may be gain (positive) or loss (negative)
 */
export function parseNsmaFile(content: string, fileName: string, color: string): MsiFile {
  const lines = content.split(/\r?\n/);
  const metadata = createEmptyMetadata();
  const horizontal: PatternPoint[] = [];
  const vertical: PatternPoint[] = [];

  let currentSection: 'header' | 'horizontal' | 'vertical' = 'header';
  let angleCounter = 0;

  const headerMap: Record<string, keyof typeof metadata> = {
    ANTMAN: 'make',
    MODNUM: 'name',
    LOWFRQ: 'frequency',
    AZESSION: 'hWidth',
    ELESSION: 'vWidth',
    PATGAIN: 'gain',
    POLAR: 'polarization',
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('!') || line.startsWith('*')) continue;

    // Check for section markers
    if (/^PATTYPE\s+H/i.test(line)) {
      currentSection = 'horizontal';
      angleCounter = 0;
      continue;
    }
    if (/^PATTYPE\s+V/i.test(line)) {
      currentSection = 'vertical';
      angleCounter = 0;
      continue;
    }

    if (currentSection === 'header') {
      const match = line.match(/^(\w+)\s+(.*)$/);
      if (match) {
        const [, key, value] = match;
        const upperKey = key.toUpperCase();
        if (upperKey in headerMap) {
          const field = headerMap[upperKey];
          if (typeof field === 'string' && field in metadata) {
            (metadata as unknown as Record<string, string>)[field] = value.trim();
          }
        } else if (upperKey === 'REVNUM' || upperKey === 'REVDATE') {
          metadata.extra[upperKey] = value.trim();
        }
      }
      continue;
    }

    // Pattern data: may have multiple values per line
    const values = line.split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
    const target = currentSection === 'horizontal' ? horizontal : vertical;

    for (const val of values) {
      if (angleCounter < 360) {
        target.push({ angleDeg: angleCounter, lossdB: val });
        angleCounter++;
      }
    }
  }

  // Use HIGHFRQ for frequency if available and LOWFRQ was empty
  if (!metadata.frequency) {
    for (const rawLine of lines) {
      const match = rawLine.trim().match(/^HIGHFRQ\s+(.*)$/i);
      if (match) {
        metadata.frequency = match[1].trim();
        break;
      }
    }
  }

  if (!metadata.name) metadata.name = fileName.replace(/\.(nsma|adf)$/i, '');

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
