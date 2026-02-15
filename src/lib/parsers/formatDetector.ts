/**
 * Detect antenna pattern file format from extension and content heuristics.
 */
export type AntennaFormat = 'msi' | 'tabular' | 'nsma' | 'planet' | 'edx' | 'xml' | 'basta3d' | 'unknown';

/** Detect format by file extension first, then by content heuristics. */
export function detectFormat(fileName: string, content: string): AntennaFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  // Extension-based detection
  if (ext === 'xml') return 'xml';
  if (ext === 'json') return detectJsonFormat(content);
  if (ext === 'nsma' || ext === 'adf') return 'nsma';
  if (ext === 'pla' || ext === 'pln') return 'planet';
  if (ext === 'pat') return 'edx';

  // Content-based detection for .msi/.txt and unknown extensions
  return detectFormatFromContent(content);
}

function detectJsonFormat(content: string): AntennaFormat {
  // Quick heuristic: BASTA 3D files have Data_Set and BASTA_AA_WP_version
  const trimmed = content.trimStart();
  if (trimmed.startsWith('{') && (content.includes('"Data_Set"') || content.includes('"BASTA_AA_WP_version"'))) {
    return 'basta3d';
  }
  // Could add other JSON formats here in the future
  return 'basta3d'; // Default JSON to BASTA 3D
}

function detectFormatFromContent(content: string): AntennaFormat {
  const trimmed = content.trimStart();

  // XML detection by content
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<ANTENNA-LIST')) return 'xml';

  // JSON detection by content
  if (trimmed.startsWith('{')) return detectJsonFormat(content);

  const lines = content.split(/\r?\n/);

  // Check for tabular format (many tab-separated columns)
  for (const line of lines) {
    const t = line.trim();
    if (t === '') continue;
    const tabCount = (t.match(/\t/g) || []).length;
    if (tabCount >= 3) return 'tabular';
    break;
  }

  // Check for NSMA markers
  for (const line of lines) {
    const t = line.trim().toUpperCase();
    if (t === '') continue;
    if (t.startsWith('REVNUM') || t.startsWith('ANTMAN') || /^PATTYPE\s+[HV]/i.test(t)) {
      return 'nsma';
    }
    if (t.startsWith('HORIZONTAL') || t.startsWith('VERTICAL')) break;
  }

  // Check for Planet format marker
  for (const line of lines) {
    if (line.trim().toUpperCase() === 'PLANET_FORMAT') return 'planet';
    if (line.trim().toUpperCase().startsWith('HORIZONTAL')) break;
  }

  // Default: standard MSI
  return 'msi';
}
