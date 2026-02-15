import { useMemo } from 'react';
import type { MsiFile } from '../types/msi';
import { analyzeSidelobes, type SidelobeResult } from '../lib/sidelobeAnalysis';
import './SidelobePanel.css';

interface SidelobePanelProps {
  file: MsiFile | null;
}

function fmt(n: number | null | undefined, decimals = 1, suffix = ''): string {
  if (n == null) return '--';
  return n.toFixed(decimals) + suffix;
}

export default function SidelobePanel({ file }: SidelobePanelProps) {
  const analysis = useMemo(() => {
    if (!file) return null;
    return {
      h: analyzeSidelobes(file.horizontal),
      v: analyzeSidelobes(file.vertical),
    };
  }, [file]);

  if (!file || !analysis) return null;

  function renderSection(label: string, result: SidelobeResult | null) {
    if (!result) return null;
    return (
      <>
        <div className="sidelobe-section-label">{label}</div>
        <div className="sidelobe-metric">
          <span className="sidelobe-metric-label">Main Lobe</span>
          <span className="sidelobe-metric-value">{result.mainLobe.angleDeg}&deg;</span>
        </div>
        <div className="sidelobe-metric">
          <span className="sidelobe-metric-label">Squint</span>
          <span className="sidelobe-metric-value">{fmt(result.squintAngle, 1, '\u00B0')}</span>
        </div>
        <div className="sidelobe-metric">
          <span className="sidelobe-metric-label">1st SLL</span>
          <span className="sidelobe-metric-value">{fmt(result.firstSLL, 1, ' dB')}</span>
        </div>
        <div className="sidelobe-metric">
          <span className="sidelobe-metric-label">F/B (computed)</span>
          <span className="sidelobe-metric-value">{fmt(result.computedFBRatio, 1, ' dB')}</span>
        </div>
      </>
    );
  }

  return (
    <div className="sidelobe-panel">
      <h3>Sidelobe Analysis</h3>
      <div className="sidelobe-metrics">
        {renderSection('Horizontal', analysis.h)}
        {renderSection('Vertical', analysis.v)}
      </div>
    </div>
  );
}

export type { SidelobeResult };
