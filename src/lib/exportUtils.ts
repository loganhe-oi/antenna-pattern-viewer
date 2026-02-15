import { jsPDF } from 'jspdf';
import type { MsiFile } from '../types/msi';
import type { ComputedFileData } from './beamwidth';
import { renderPolarToImage, renderRectangularToImage } from './plotRenderer';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function fmt(n: number | null, suffix = ''): string {
  if (n === null) return '--';
  return n.toFixed(1) + suffix;
}

/* ------------------------------------------------------------------ */
/*  Row definitions (shared between table & CSV)                      */
/* ------------------------------------------------------------------ */

interface RowDef {
  label: string;
  getValue: (file: MsiFile, cd: ComputedFileData) => string;
}

function getRowDefs(): RowDef[] {
  return [
    { label: 'Name', getValue: (f) => f.metadata.name || f.fileName },
    { label: 'Manufacturer', getValue: (f) => f.metadata.make || '--' },
    { label: 'Frequency (MHz)', getValue: (f) => f.metadata.frequency || '--' },
    { label: 'Gain (dBi)', getValue: (f) => f.metadata.gain || '--' },
    { label: 'H Beamwidth 3dB', getValue: (_f, cd) => fmt(cd.hBeamwidths.bw3dB, '\u00B0') },
    { label: 'V Beamwidth 3dB', getValue: (_f, cd) => fmt(cd.vBeamwidths.bw3dB, '\u00B0') },
    { label: 'H Beamwidth 10dB', getValue: (_f, cd) => fmt(cd.hBeamwidths.bw10dB, '\u00B0') },
    { label: 'V Beamwidth 10dB', getValue: (_f, cd) => fmt(cd.vBeamwidths.bw10dB, '\u00B0') },
    { label: 'Front-to-Back (dB)', getValue: (f) => f.metadata.frontToBack || '--' },
    { label: 'Tilt Type', getValue: (f) => f.metadata.tilt || '--' },
    { label: 'Electrical Tilt', getValue: (f) => f.metadata.electricalTilt ? f.metadata.electricalTilt + '\u00B0' : '--' },
    { label: 'H 1st SLL (dB)', getValue: (_f, cd) => fmt(cd.hSidelobes?.firstSLL ?? null) },
    { label: 'V 1st SLL (dB)', getValue: (_f, cd) => fmt(cd.vSidelobes?.firstSLL ?? null) },
    { label: 'H Squint', getValue: (_f, cd) => cd.hSidelobes ? fmt(cd.hSidelobes.squintAngle, '\u00B0') : '--' },
    { label: 'H F/B (computed)', getValue: (_f, cd) => fmt(cd.hSidelobes?.computedFBRatio ?? null) },
  ];
}

export { getRowDefs };
export type { RowDef };

/* ------------------------------------------------------------------ */
/*  Export as Standard MSI File                                       */
/* ------------------------------------------------------------------ */

function buildPatternBlock(label: string, points: { angleDeg: number; lossdB: number }[]): string {
  const lookup = new Map<number, number>();
  for (const p of points) lookup.set(Math.round(p.angleDeg) % 360, p.lossdB);
  const lines: string[] = [`${label} 360`];
  for (let a = 0; a < 360; a++) {
    lines.push(`${a}\t${(lookup.get(a) ?? 0).toFixed(1)}`);
  }
  return lines.join('\n');
}

function computeTotalTilt(file: MsiFile): number {
  const baseTilt = parseFloat(file.metadata.electricalTilt) || 0;
  const adj = file.adjustments;
  return baseTilt + (adj?.mechanicalDowntilt ?? 0) + (adj?.electricalTiltDelta ?? 0);
}

function buildMsiFilename(file: MsiFile): string {
  const baseName = (file.metadata.name || file.fileName).replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
  const totalTilt = computeTotalTilt(file);
  return `${baseName}_${totalTilt.toFixed(1)}T.msi`;
}

export function exportMsiFile(file: MsiFile) {
  const m = file.metadata;
  const totalTilt = computeTotalTilt(file);

  const lines: string[] = [];
  if (m.name) lines.push(`NAME ${m.name}`);
  if (m.make) lines.push(`MAKE ${m.make}`);
  if (m.frequency) lines.push(`FREQUENCY ${m.frequency}`);
  if (m.gain) lines.push(`GAIN ${m.gain}`);
  if (m.hWidth) lines.push(`H_WIDTH ${m.hWidth}`);
  if (m.vWidth) lines.push(`V_WIDTH ${m.vWidth}`);
  if (m.frontToBack) lines.push(`FRONT_TO_BACK ${m.frontToBack}`);
  lines.push(`TILT ${totalTilt !== 0 ? 'ELECTRICAL' : (m.tilt || 'NONE')}`);
  lines.push(`ELECTRICAL_TILT ${totalTilt.toFixed(1)}`);
  if (m.polarization) lines.push(`POLARIZATION ${m.polarization}`);
  if (m.comment) lines.push(`COMMENT ${m.comment}`);
  // Extra metadata
  for (const [k, v] of Object.entries(m.extra)) {
    if (v) lines.push(`${k} ${v}`);
  }
  lines.push('');
  lines.push(buildPatternBlock('HORIZONTAL', file.horizontal));
  lines.push('');
  lines.push(buildPatternBlock('VERTICAL', file.vertical));
  lines.push('');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, buildMsiFilename(file));
}

/* ------------------------------------------------------------------ */
/*  Export as Atoll TXT (tab-separated)                               */
/* ------------------------------------------------------------------ */

export function exportAtollTxt(file: MsiFile) {
  const m = file.metadata;
  const totalTilt = computeTotalTilt(file);

  const hLookup = new Map<number, number>();
  const vLookup = new Map<number, number>();
  for (const p of file.horizontal) hLookup.set(Math.round(p.angleDeg) % 360, p.lossdB);
  for (const p of file.vertical) vLookup.set(Math.round(p.angleDeg) % 360, p.lossdB);

  const lines: string[] = [];
  // Header row with metadata
  lines.push([
    'Antenna Name',
    'Frequency (MHz)',
    'Gain (dBi)',
    'H_Width (deg)',
    'V_Width (deg)',
    'Tilt (deg)',
    'Polarization',
  ].join('\t'));
  lines.push([
    m.name || file.fileName,
    m.frequency || '',
    m.gain || '',
    m.hWidth || '',
    m.vWidth || '',
    totalTilt.toFixed(1),
    m.polarization || '',
  ].join('\t'));
  lines.push('');
  // Pattern data header
  lines.push(['Angle (deg)', 'H Loss (dB)', 'V Loss (dB)'].join('\t'));
  for (let a = 0; a < 360; a++) {
    lines.push([
      String(a),
      (hLookup.get(a) ?? 0).toFixed(1),
      (vLookup.get(a) ?? 0).toFixed(1),
    ].join('\t'));
  }

  const baseName = (m.name || file.fileName).replace(/\.[^.]+$/, '').replace(/\s+/g, '_');
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${baseName}_${totalTilt.toFixed(1)}T.txt`);
}

/* ------------------------------------------------------------------ */
/*  Batch export all visible files                                    */
/* ------------------------------------------------------------------ */

export function exportAllMsi(files: MsiFile[]) {
  for (const f of files) exportMsiFile(f);
}

export function exportAllAtollTxt(files: MsiFile[]) {
  for (const f of files) exportAtollTxt(f);
}

/* ------------------------------------------------------------------ */
/*  1. Export Parameters CSV                                          */
/* ------------------------------------------------------------------ */

export function exportParametersCsv(files: MsiFile[], computed: ComputedFileData[]) {
  const rows = getRowDefs();
  const header = ['Parameter', ...files.map(f => f.metadata.name || f.fileName)];
  const lines = [header.map(csvEscape).join(',')];

  for (const row of rows) {
    const cells = [row.label, ...files.map((f, i) => row.getValue(f, computed[i]))];
    lines.push(cells.map(csvEscape).join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, 'antenna_parameters.csv');
}

/* ------------------------------------------------------------------ */
/*  2. Export Pattern Data CSV                                        */
/* ------------------------------------------------------------------ */

export function exportPatternDataCsv(files: MsiFile[]) {
  const lookups = files.map(f => {
    const hMap = new Map<number, number>();
    const vMap = new Map<number, number>();
    for (const p of f.horizontal) hMap.set(Math.round(p.angleDeg), p.lossdB);
    for (const p of f.vertical) vMap.set(Math.round(p.angleDeg), p.lossdB);
    return { hMap, vMap };
  });

  const names = files.map(f => f.metadata.name || f.fileName);
  const header = ['Angle', ...names.flatMap(n => [`${n}_H`, `${n}_V`])];
  const lines = [header.map(csvEscape).join(',')];

  for (let angle = 0; angle < 360; angle++) {
    const cells: string[] = [String(angle)];
    for (const lk of lookups) {
      cells.push(String(lk.hMap.get(angle) ?? ''));
      cells.push(String(lk.vMap.get(angle) ?? ''));
    }
    lines.push(cells.join(','));
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, 'antenna_pattern_data.csv');
}

/* ------------------------------------------------------------------ */
/*  3. Export Report PDF                                              */
/* ------------------------------------------------------------------ */

// Letter landscape dimensions
const PAGE_W = 279.4;
const PAGE_H = 215.9;
const MARGIN = 14;
const USABLE_W = PAGE_W - MARGIN * 2;

function addHeader(doc: jsPDF, rightText?: string) {
  doc.setFontSize(10);
  doc.setTextColor(50);
  doc.setFont('helvetica', 'bold');
  doc.text('ORAN Infra Inc.', MARGIN, 10);
  doc.setFont('helvetica', 'normal');
  if (rightText) {
    const truncated = rightText.length > 60 ? rightText.slice(0, 57) + '...' : rightText;
    doc.text(truncated, PAGE_W - MARGIN, 10, { align: 'right' });
  }
  doc.setDrawColor(200);
  doc.line(MARGIN, 13, PAGE_W - MARGIN, 13);
}

function addFooter(doc: jsPDF, pageNum: number) {
  doc.setFontSize(7);
  doc.setTextColor(140);
  doc.text('Confidential \u2014 ORAN Infra Inc.', MARGIN, PAGE_H - 6);
  doc.text(`Page ${pageNum}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' });
}

function drawParamTable(
  doc: jsPDF,
  files: MsiFile[],
  computed: ComputedFileData[],
  startY: number,
): number {
  const rows = getRowDefs();
  const colCount = files.length + 1;
  const colW = Math.min(45, USABLE_W / colCount);
  const rowH = 6;
  let y = startY;

  // Header
  doc.setFillColor(230, 230, 230);
  doc.rect(MARGIN, y, colW * colCount, rowH, 'F');
  doc.setFontSize(7);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text('Parameter', MARGIN + 2, y + 4);
  for (let i = 0; i < files.length; i++) {
    const name = (files[i].metadata.name || files[i].fileName);
    const truncated = name.length > 20 ? name.slice(0, 18) + '..' : name;
    doc.text(truncated, MARGIN + colW * (i + 1) + 2, y + 4);
  }
  y += rowH;

  // Rows
  doc.setFont('helvetica', 'normal');
  for (let ri = 0; ri < rows.length; ri++) {
    if (ri % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(MARGIN, y, colW * colCount, rowH, 'F');
    }
    doc.setTextColor(80);
    doc.text(rows[ri].label, MARGIN + 2, y + 4);
    doc.setTextColor(30);
    for (let ci = 0; ci < files.length; ci++) {
      doc.text(rows[ri].getValue(files[ci], computed[ci]), MARGIN + colW * (ci + 1) + 2, y + 4);
    }
    y += rowH;
  }

  return y;
}

export async function exportReportPdf(
  files: MsiFile[],
  computed: ComputedFileData[],
  overlayImages: {
    horizontal: string;
    vertical: string;
    rectHorizontal?: string;
    rectVertical?: string;
  },
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
  let pageNum = 1;

  // ===== Title Page =====
  addHeader(doc);
  doc.setFontSize(24);
  doc.setTextColor(30);
  doc.text('ORAN Infra Inc.', MARGIN, 45);

  doc.setFontSize(16);
  doc.setTextColor(80);
  doc.text('Antenna Pattern Report', MARGIN, 58);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, MARGIN, 72);
  doc.text(`Antennas: ${files.length}`, MARGIN, 80);

  // List antenna names
  doc.setFontSize(9);
  let listY = 92;
  for (const f of files) {
    const name = f.metadata.name || f.fileName;
    doc.text(`\u2022  ${name}`, MARGIN + 4, listY);
    listY += 5;
    if (listY > PAGE_H - 20) break;
  }

  addFooter(doc, pageNum);

  // ===== Per-Antenna Pages =====
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const cd = computed[i];
    const name = file.metadata.name || file.fileName;

    doc.addPage();
    pageNum++;
    addHeader(doc, name);

    // Single-antenna parameter table (2 columns: label + value)
    const rows = getRowDefs();
    const tableColW = 50;
    const valColW = 60;
    const rowH = 5.5;
    let y = 18;

    doc.setFontSize(11);
    doc.setTextColor(30);
    doc.text(name, MARGIN, y);
    y += 8;

    doc.setFontSize(7);
    for (let ri = 0; ri < rows.length; ri++) {
      if (ri % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(MARGIN, y - 3.5, tableColW + valColW, rowH, 'F');
      }
      doc.setTextColor(80);
      doc.text(rows[ri].label, MARGIN + 2, y);
      doc.setTextColor(30);
      doc.text(rows[ri].getValue(file, cd), MARGIN + tableColW + 2, y);
      y += rowH;
    }

    // Polar plots side-by-side (off-screen rendered for single file)
    const polarW = (USABLE_W - 10) / 2;
    const polarH = polarW * (900 / 1200);

    const [hPolar, vPolar] = await Promise.all([
      renderPolarToImage([file], 'horizontal', { width: 1200, height: 900 }),
      renderPolarToImage([file], 'vertical', { width: 1200, height: 900 }),
    ]);

    const plotStartY = y + 4;
    if (plotStartY + polarH > PAGE_H - 12) {
      // Not enough room; plots go on next page
      addFooter(doc, pageNum);
      doc.addPage();
      pageNum++;
      addHeader(doc, name);
      doc.addImage(hPolar, 'PNG', MARGIN, 18, polarW, polarH);
      doc.addImage(vPolar, 'PNG', MARGIN + polarW + 10, 18, polarW, polarH);

      // Rectangular plot below polars
      const rectY = 18 + polarH + 6;
      const rectW = USABLE_W;
      const rectH = rectW * (500 / 1400);
      if (rectY + rectH < PAGE_H - 12) {
        const hRect = await renderRectangularToImage([file], 'horizontal', { width: 1400, height: 500 });
        doc.addImage(hRect, 'PNG', MARGIN, rectY, rectW, rectH);
      }
    } else {
      doc.addImage(hPolar, 'PNG', MARGIN, plotStartY, polarW, polarH);
      doc.addImage(vPolar, 'PNG', MARGIN + polarW + 10, plotStartY, polarW, polarH);

      // Rectangular plot below polars
      const rectY = plotStartY + polarH + 6;
      const rectW = USABLE_W;
      const rectH = rectW * (500 / 1400);
      if (rectY + rectH < PAGE_H - 12) {
        const hRect = await renderRectangularToImage([file], 'horizontal', { width: 1400, height: 500 });
        doc.addImage(hRect, 'PNG', MARGIN, rectY, rectW, rectH);
      }
    }

    addFooter(doc, pageNum);
  }

  // ===== Comparison Page (if >1 antenna) =====
  if (files.length > 1) {
    doc.addPage();
    pageNum++;
    addHeader(doc, 'Multi-Antenna Comparison');

    // Comparison parameter table
    let y = drawParamTable(doc, files, computed, 18);

    // Overlay polar plots
    const polarW = (USABLE_W - 10) / 2;
    const polarH = polarW * (900 / 1200);

    if (y + polarH + 10 > PAGE_H - 12) {
      addFooter(doc, pageNum);
      doc.addPage();
      pageNum++;
      addHeader(doc, 'Multi-Antenna Comparison');
      y = 18;
    } else {
      y += 6;
    }

    doc.addImage(overlayImages.horizontal, 'PNG', MARGIN, y, polarW, polarH);
    doc.addImage(overlayImages.vertical, 'PNG', MARGIN + polarW + 10, y, polarW, polarH);
    y += polarH + 6;

    // Overlay rectangular plot
    if (overlayImages.rectHorizontal) {
      const rectW = USABLE_W;
      const rectH = rectW * (500 / 1400);
      if (y + rectH > PAGE_H - 12) {
        addFooter(doc, pageNum);
        doc.addPage();
        pageNum++;
        addHeader(doc, 'Multi-Antenna Comparison');
        y = 18;
      }
      doc.addImage(overlayImages.rectHorizontal, 'PNG', MARGIN, y, rectW, rectH);
    }

    addFooter(doc, pageNum);
  }

  doc.save('antenna_pattern_report.pdf');
}
