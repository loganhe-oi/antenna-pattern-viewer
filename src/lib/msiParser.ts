import type { MsiMetadata, MsiFile, PatternPoint } from '../types/msi';
import { PLOT_COLORS } from '../constants/plotColors';
import { detectFormat } from './parsers/formatDetector';
import { parseNsmaFile } from './parsers/nsmaParser';
import { parsePlanetFile } from './parsers/planetParser';
import { parseEdxFile } from './parsers/edxParser';
import { parseXmlFile } from './parsers/xmlParser';
import { parseBasta3dFile } from './parsers/basta3dParser';

// --- Types ---

interface PatternData {
  angles: number[];
  values: number[];
}

// --- Helpers ---

function createEmptyMetadata(): MsiMetadata {
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

const KEY_MAP: Record<string, keyof Omit<MsiMetadata, 'extra'>> = {
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

const TABULAR_COL_MAP: Record<string, keyof Omit<MsiMetadata, 'extra'>> = {
  name: 'name',
  antenna: 'name',
  'antenna name': 'name',
  make: 'make',
  manufacturer: 'make',
  frequency: 'frequency',
  'frequency (mhz)': 'frequency',
  gain: 'gain',
  'gain (dbi)': 'gain',
  'gain (dbd)': 'gain',
  'h-width': 'hWidth',
  h_width: 'hWidth',
  'horizontal beamwidth': 'hWidth',
  'v-width': 'vWidth',
  v_width: 'vWidth',
  'vertical beamwidth': 'vWidth',
  'front to back': 'frontToBack',
  front_to_back: 'frontToBack',
  tilt: 'tilt',
  'electrical tilt': 'electricalTilt',
  electrical_tilt: 'electricalTilt',
  polarization: 'polarization',
};

function parseHeaderLine(line: string, meta: MsiMetadata): void {
  const match = line.match(/^(\S+)\s+(.*)$/);
  if (!match) return;
  const [, key, value] = match;
  const field = KEY_MAP[key.toUpperCase()];
  if (field) {
    meta[field] = value.trim();
  } else {
    meta.extra[key] = value.trim();
  }
}

function parseDataLine(line: string): PatternPoint | null {
  const parts = line.trim().split(/[\s\t]+/);
  if (parts.length < 2) return null;
  const angle = parseFloat(parts[0]);
  const value = parseFloat(parts[1]);
  if (isNaN(angle) || isNaN(value)) return null;
  return { angleDeg: angle, lossdB: value };
}

function normalizeToLoss(points: PatternPoint[]): PatternPoint[] {
  if (points.length === 0) return points;
  const minVal = Math.min(...points.map(p => p.lossdB));
  if (minVal >= 0) return points;
  const maxVal = Math.max(...points.map(p => p.lossdB));
  return points.map(p => ({
    angleDeg: p.angleDeg,
    lossdB: maxVal - p.lossdB,
  }));
}

function patternDataToPoints(pd: PatternData): PatternPoint[] {
  return pd.angles.map((a, i) => ({ angleDeg: a, lossdB: pd.values[i] }));
}

// --- Tabular format: extractPatternsFromCell ---

/**
 * Extract pattern data from a cell's space-separated content.
 * Finds the "360" token, then reads 360 angle-value pairs after it.
 * Includes a sanity check: angles should be roughly sequential (0, 1, 2, ...).
 * Requires at least 180 pairs to be considered valid.
 */
function extractPatternsFromCell(cellData: string): PatternData[] {
  const tokens = cellData.trim().split(/\s+/);
  const results: PatternData[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i] === '360') {
      const angles: number[] = [];
      const values: number[] = [];
      let j = i + 1;
      let pairsRead = 0;
      while (j + 1 < tokens.length && pairsRead < 360) {
        const angle = parseFloat(tokens[j]);
        const value = parseFloat(tokens[j + 1]);
        if (isNaN(angle) || isNaN(value)) break;
        if (pairsRead > 2 && Math.abs(angle - pairsRead) > 1) break;
        angles.push(angle);
        values.push(value);
        j += 2;
        pairsRead++;
      }
      if (pairsRead >= 180) {
        results.push({ angles, values });
      }
      i = j;
    } else {
      i++;
    }
  }
  return results;
}

// --- Tabular parser ---

function parseTabular(content: string, fileName: string): MsiFile[] {
  const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) return [];

  const headers = lines[0].split('\t').map(h => h.trim());

  console.log('[MSI Parser] Tabular: column count =', headers.length);
  console.log('[MSI Parser] Tabular: headers =', headers);

  // Find ALL "Pattern" column indices — the header has duplicates
  // First "Pattern" = H pattern, second "Pattern" = V pattern
  const patternColIndices: number[] = [];
  const colMeta: Map<number, keyof Omit<MsiMetadata, 'extra'>> = new Map();
  const colExtra: Map<number, string> = new Map();

  for (let c = 0; c < headers.length; c++) {
    const h = headers[c];
    const hLower = h.toLowerCase().trim();

    if (/^pattern$/i.test(h)) {
      patternColIndices.push(c);
      continue;
    }
    if (/horizontal.*pattern|h[_-]?pattern|pattern.*horiz/i.test(h)) {
      patternColIndices.unshift(c); // H goes first
      continue;
    }
    if (/vertical.*pattern|v[_-]?pattern|pattern.*vert/i.test(h)) {
      patternColIndices.push(c); // V goes second
      continue;
    }

    // Try exact match first, then strip parenthetical units
    const stripped = hLower.replace(/\s*\(.*\)\s*$/, '').trim();
    const metaKey = TABULAR_COL_MAP[hLower] || TABULAR_COL_MAP[stripped];
    if (metaKey) {
      colMeta.set(c, metaKey);
    } else {
      colExtra.set(c, h);
    }
  }

  const hPatternCol = patternColIndices.length > 0 ? patternColIndices[0] : -1;
  const vPatternCol = patternColIndices.length > 1 ? patternColIndices[1] : -1;

  console.log('[MSI Parser] Tabular: pattern column indices =', patternColIndices);
  console.log('[MSI Parser] Tabular: hPatternCol =', hPatternCol,
    hPatternCol >= 0 ? `("${headers[hPatternCol]}")` : '');
  console.log('[MSI Parser] Tabular: vPatternCol =', vPatternCol,
    vPatternCol >= 0 ? `("${headers[vPatternCol]}")` : '');

  const results: MsiFile[] = [];

  for (let row = 1; row < lines.length; row++) {
    const cells = lines[row].split('\t');
    if (cells.length === 0 || cells.every(c => c.trim() === '')) continue;

    const metadata = createEmptyMetadata();

    for (const [col, field] of colMeta) {
      if (col < cells.length && cells[col].trim()) {
        metadata[field] = cells[col].trim();
      }
    }
    for (const [col, header] of colExtra) {
      if (col < cells.length && cells[col].trim()) {
        metadata.extra[header] = cells[col].trim();
      }
    }

    // Extract pattern data
    // Case 1: Single "Pattern" column with both H and V (two "360" blocks)
    // Case 2: Separate H and V pattern columns
    let horizontal: PatternPoint[] = [];
    let vertical: PatternPoint[] = [];

    if (hPatternCol >= 0 && vPatternCol < 0) {
      // Single pattern column — extract all 360-blocks from it
      // First block = H, second block = V
      if (hPatternCol < cells.length) {
        const allPatterns = extractPatternsFromCell(cells[hPatternCol]);
        if (row <= 3) {
          console.log(`[MSI Parser] Row ${row}: single Pattern col, extractPatternsFromCell returned ${allPatterns.length} pattern(s)`,
            allPatterns.map(p => `${p.angles.length} pts`));
        }
        if (allPatterns.length > 0) {
          horizontal = normalizeToLoss(patternDataToPoints(allPatterns[0]));
        }
        if (allPatterns.length > 1) {
          vertical = normalizeToLoss(patternDataToPoints(allPatterns[1]));
        }
      }
    } else {
      // Separate H and V columns
      if (hPatternCol >= 0 && hPatternCol < cells.length) {
        const hPatterns = extractPatternsFromCell(cells[hPatternCol]);
        if (row <= 3) {
          console.log(`[MSI Parser] Row ${row} H col: extractPatternsFromCell returned ${hPatterns.length} pattern(s)`,
            hPatterns.map(p => `${p.angles.length} pts`));
        }
        if (hPatterns.length > 0) {
          horizontal = normalizeToLoss(patternDataToPoints(hPatterns[0]));
        }
      }
      if (vPatternCol >= 0 && vPatternCol < cells.length) {
        const vPatterns = extractPatternsFromCell(cells[vPatternCol]);
        if (row <= 3) {
          console.log(`[MSI Parser] Row ${row} V col: extractPatternsFromCell returned ${vPatterns.length} pattern(s)`,
            vPatterns.map(p => `${p.angles.length} pts`));
        }
        if (vPatterns.length > 0) {
          vertical = normalizeToLoss(patternDataToPoints(vPatterns[0]));
        }
      }
    }

    const antennaName = metadata.name || `Row ${row}`;
    const color = PLOT_COLORS[(results.length) % PLOT_COLORS.length];

    if (results.length < 5 || (results.length % 500 === 0)) {
      console.log(`[MSI Parser] Row ${row}: "${antennaName}" — H=${horizontal.length} pts, V=${vertical.length} pts`);
    }

    results.push({
      id: crypto.randomUUID(),
      fileName: `${fileName} — ${antennaName}`,
      metadata,
      horizontal,
      vertical,
      color,
      visible: results.length < 1, // only first antenna visible by default
    });
  }

  console.log('[MSI Parser] Tabular result:', fileName, {
    totalColumns: headers.length,
    totalRows: results.length,
    hPatternCol,
    vPatternCol,
  });

  return results;
}

// --- Standard MSI parser ---

function parseStandard(content: string, fileName: string, color: string): MsiFile {
  const lines = content.split(/\r?\n/);
  const metadata = createEmptyMetadata();
  const horizontal: PatternPoint[] = [];
  const vertical: PatternPoint[] = [];

  type Section = 'header' | 'horizontal' | 'vertical';
  let section: Section = 'header';

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
      parseHeaderLine(line, metadata);
    } else {
      const point = parseDataLine(line);
      if (point) {
        (section === 'horizontal' ? horizontal : vertical).push(point);
      }
    }
  }

  const result: MsiFile = {
    id: crypto.randomUUID(),
    fileName,
    metadata,
    horizontal: normalizeToLoss(horizontal),
    vertical: normalizeToLoss(vertical),
    color,
    visible: true,
  };

  console.log('[MSI Parser] Standard format:', fileName, {
    metadataName: metadata.name,
    horizontalPoints: result.horizontal.length,
    verticalPoints: result.vertical.length,
  });

  return result;
}

// --- Public API ---

/**
 * Parse an antenna pattern file, auto-detecting format.
 * Returns a single MsiFile for standard formats,
 * or an array of MsiFile[] for Atoll tabular export format.
 */
export function parseMsiFile(
  content: string,
  fileName: string,
  color: string,
): MsiFile | MsiFile[] {
  const format = detectFormat(fileName, content);

  switch (format) {
    case 'xml':
      return parseXmlFile(content, fileName);
    case 'basta3d':
      return parseBasta3dFile(content, fileName, color);
    case 'nsma':
      return parseNsmaFile(content, fileName, color);
    case 'planet':
      return parsePlanetFile(content, fileName, color);
    case 'edx':
      return parseEdxFile(content, fileName, color);
    case 'tabular':
      return parseTabular(content, fileName);
    default:
      return parseStandard(content, fileName, color);
  }
}
