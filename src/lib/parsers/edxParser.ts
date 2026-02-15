import type { MsiFile, PatternPoint } from '../../types/msi';
import { createEmptyMetadata, normalizeToLoss } from './parserUtils';

/**
 * Parse EDX SignalPro (.pat) antenna pattern files.
 *
 * Format: Simple list of 360 gain/loss values (one per degree, 0-359),
 * optionally preceded by header lines starting with comments or metadata.
 * May have separate H and V sections or a single pattern.
 */
export function parseEdxFile(content: string, fileName: string, color: string): MsiFile {
  const lines = content.split(/\r?\n/);
  const metadata = createEmptyMetadata();
  const horizontal: PatternPoint[] = [];
  const vertical: PatternPoint[] = [];

  let currentTarget = horizontal;
  let angleCounter = 0;
  let headerDone = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '') continue;

    // Comment/header lines
    if (line.startsWith('#') || line.startsWith(';') || line.startsWith('!')) {
      const kvMatch = line.slice(1).trim().match(/^(\w[\w\s]*?)[:=]\s*(.+)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        const keyLower = key.toLowerCase().trim();
        if (keyLower === 'name' || keyLower === 'antenna') metadata.name = value.trim();
        else if (keyLower === 'gain') metadata.gain = value.trim();
        else if (keyLower === 'frequency') metadata.frequency = value.trim();
        else if (keyLower === 'manufacturer' || keyLower === 'make') metadata.make = value.trim();
        else metadata.extra[key.trim()] = value.trim();
      }
      continue;
    }

    // Section markers
    if (/^(horizontal|azimuth|h-?pattern)/i.test(line)) {
      currentTarget = horizontal;
      angleCounter = 0;
      headerDone = true;
      continue;
    }
    if (/^(vertical|elevation|v-?pattern)/i.test(line)) {
      currentTarget = vertical;
      angleCounter = 0;
      headerDone = true;
      continue;
    }

    // Try parsing as angle-value pair first
    const parts = line.split(/[\s\t,]+/);
    if (parts.length >= 2) {
      const a = parseFloat(parts[0]);
      const v = parseFloat(parts[1]);
      if (!isNaN(a) && !isNaN(v)) {
        headerDone = true;
        currentTarget.push({ angleDeg: a, lossdB: v });
        continue;
      }
    }

    // Single value per line (angle implied by position)
    const val = parseFloat(line);
    if (!isNaN(val)) {
      headerDone = true;
      currentTarget.push({ angleDeg: angleCounter, lossdB: val });
      angleCounter++;
      // After 360 values, switch to vertical
      if (angleCounter === 360 && currentTarget === horizontal) {
        currentTarget = vertical;
        angleCounter = 0;
      }
    } else if (!headerDone) {
      // Non-numeric, non-comment line before data — treat as metadata
      const kvMatch = line.match(/^(\w[\w\s]*?)[:=]\s*(.+)$/);
      if (kvMatch) {
        metadata.extra[kvMatch[1].trim()] = kvMatch[2].trim();
      }
    }
  }

  if (!metadata.name) metadata.name = fileName.replace(/\.pat$/i, '');

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
