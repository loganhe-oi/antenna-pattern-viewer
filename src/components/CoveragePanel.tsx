import { useState, useMemo } from 'react';
import type { MsiFile } from '../types/msi';
import type { CoverageParams, EnvironmentType } from '../types/coverage';
import { computeBeamwidths } from '../lib/beamwidth';
import {
  computeBeamProjection,
  computeFsplRange,
  computeCostHata,
  computeCoverageArea,
} from '../lib/coverageModels';
import './CoveragePanel.css';

interface CoveragePanelProps {
  file: MsiFile | null;
}

const DEFAULT_PARAMS: CoverageParams = {
  antennaHeight: 30,
  txPower: 43,
  environmentType: 'urban',
  receiveThreshold: -100,
  mobileHeight: 1.5,
};

function fmt(n: number | null | undefined, decimals = 1, suffix = ''): string {
  if (n == null || !isFinite(n)) return '--';
  return n.toFixed(decimals) + suffix;
}

function fmtDist(meters: number | null | undefined): string {
  if (meters == null || !isFinite(meters)) return '--';
  if (meters >= 1000) return (meters / 1000).toFixed(2) + ' km';
  return meters.toFixed(0) + ' m';
}

function fmtKm(km: number | null | undefined): string {
  if (km == null || !isFinite(km)) return '--';
  return km.toFixed(2) + ' km';
}

const Chevron = () => (
  <svg className="coverage-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 4l4 4-4 4" />
  </svg>
);

export default function CoveragePanel({ file }: CoveragePanelProps) {
  const [params, setParams] = useState<CoverageParams>(DEFAULT_PARAMS);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    beam: true,
    fspl: false,
    hata: false,
    area: false,
  });

  const results = useMemo(() => {
    if (!file) return null;

    const freq = parseFloat(file.metadata.frequency) || 0;
    const gain = parseFloat(file.metadata.gain) || 0;

    // Beamwidths: prefer metadata, fallback to computed
    const metaVBW = parseFloat(file.metadata.vWidth);
    const metaHBW = parseFloat(file.metadata.hWidth);
    const computed = computeBeamwidths(file.vertical);
    const computedH = computeBeamwidths(file.horizontal);
    const vBW = (metaVBW > 0 ? metaVBW : computed.bw3dB) || 0;
    const hBW = (metaHBW > 0 ? metaHBW : computedH.bw3dB) || 0;

    // Total downtilt = metadata tilt + mechanical adjustment
    const baseTilt = parseFloat(file.metadata.tilt) || 0;
    const mechTilt = file.adjustments?.mechanicalDowntilt ?? 0;
    const totalDowntilt = baseTilt + mechTilt;

    const beam = computeBeamProjection(params.antennaHeight, totalDowntilt, vBW, hBW);

    const fspl = freq > 0
      ? computeFsplRange(freq, params.txPower, gain, params.receiveThreshold)
      : null;

    const hata = freq > 0
      ? computeCostHata(freq, params.antennaHeight, params.mobileHeight, params.txPower, gain, params.receiveThreshold, params.environmentType)
      : null;

    const propMaxRange = hata?.maxRange ?? fspl?.maxRange ?? null;
    const area = computeCoverageArea(beam, propMaxRange, hBW);

    return { beam, fspl, hata, area, freq, gain, vBW, hBW, totalDowntilt };
  }, [file, params]);

  function toggleSection(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function updateNum(key: keyof CoverageParams, raw: string) {
    const num = parseFloat(raw);
    if (!isNaN(num)) {
      setParams(prev => ({ ...prev, [key]: num }));
    }
  }

  if (!file) {
    return (
      <div className="coverage-panel">
        <h3>Coverage Estimation</h3>
        <p className="coverage-no-selection">Select a file to estimate coverage</p>
      </div>
    );
  }

  return (
    <div className="coverage-panel">
      <h3>Coverage Estimation</h3>

      {/* Input controls */}
      <div className="coverage-inputs">
        <div className="coverage-input-row">
          <span className="coverage-input-label">Antenna Height</span>
          <input
            className="coverage-input"
            type="number"
            min={1} max={500} step={1}
            value={params.antennaHeight}
            onChange={e => updateNum('antennaHeight', e.target.value)}
          />
        </div>
        <div className="coverage-input-row">
          <span className="coverage-input-label">TX Power (dBm)</span>
          <input
            className="coverage-input"
            type="number"
            min={0} max={60} step={1}
            value={params.txPower}
            onChange={e => updateNum('txPower', e.target.value)}
          />
        </div>
        <div className="coverage-input-row">
          <span className="coverage-input-label">Environment</span>
          <select
            className="coverage-select"
            value={params.environmentType}
            onChange={e => setParams(prev => ({ ...prev, environmentType: e.target.value as EnvironmentType }))}
          >
            <option value="urban">Urban</option>
            <option value="suburban">Suburban</option>
            <option value="open">Open</option>
          </select>
        </div>
        <div className="coverage-input-row">
          <span className="coverage-input-label">Rx Threshold (dBm)</span>
          <input
            className="coverage-input"
            type="number"
            min={-130} max={-50} step={1}
            value={params.receiveThreshold}
            onChange={e => updateNum('receiveThreshold', e.target.value)}
          />
        </div>
        <div className="coverage-input-row">
          <span className="coverage-input-label">Mobile Height (m)</span>
          <input
            className="coverage-input"
            type="number"
            min={0.5} max={10} step={0.5}
            value={params.mobileHeight}
            onChange={e => updateNum('mobileHeight', e.target.value)}
          />
        </div>
      </div>

      {/* Beam Projection */}
      <div className={`coverage-section ${expanded.beam ? 'expanded' : ''}`}>
        <div className="coverage-section-header" onClick={() => toggleSection('beam')}>
          <Chevron />
          <span className="coverage-section-title">Beam Projection</span>
        </div>
        <div className="coverage-section-body">
          {results?.totalDowntilt != null && results.totalDowntilt <= 0 ? (
            <p className="coverage-info">Set downtilt &gt; 0&deg; for beam projection</p>
          ) : (
            <div className="coverage-metrics">
              <div className="coverage-metric">
                <span className="coverage-metric-label">Center Dist.</span>
                <span className="coverage-metric-value">{fmtDist(results?.beam?.centerDistance)}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">Sector Width</span>
                <span className="coverage-metric-value">{fmtDist(results?.beam?.sectorWidth)}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">Inner Edge</span>
                <span className="coverage-metric-value">{fmtDist(results?.beam?.innerEdge)}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">Outer Edge</span>
                <span className="coverage-metric-value">{fmtDist(results?.beam?.outerEdge)}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">Downtilt</span>
                <span className="coverage-metric-value">{fmt(results?.totalDowntilt, 1, '\u00B0')}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">V Beamwidth</span>
                <span className="coverage-metric-value">{fmt(results?.vBW, 1, '\u00B0')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Free-Space Path Loss */}
      <div className={`coverage-section ${expanded.fspl ? 'expanded' : ''}`}>
        <div className="coverage-section-header" onClick={() => toggleSection('fspl')}>
          <Chevron />
          <span className="coverage-section-title">Free-Space Path Loss</span>
        </div>
        <div className="coverage-section-body">
          {results?.freq === 0 ? (
            <p className="coverage-info">Frequency not available in file metadata</p>
          ) : (
            <div className="coverage-metrics">
              <div className="coverage-metric">
                <span className="coverage-metric-label">Max Range</span>
                <span className="coverage-metric-value">{fmtKm(results?.fspl?.maxRange)}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">FSPL at Max</span>
                <span className="coverage-metric-value">{fmt(results?.fspl?.fsplAtMaxRange, 1, ' dB')}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">Frequency</span>
                <span className="coverage-metric-value">{fmt(results?.freq, 0, ' MHz')}</span>
              </div>
              <div className="coverage-metric">
                <span className="coverage-metric-label">Antenna Gain</span>
                <span className="coverage-metric-value">{fmt(results?.gain, 1, ' dBi')}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COST-231 Hata */}
      <div className={`coverage-section ${expanded.hata ? 'expanded' : ''}`}>
        <div className="coverage-section-header" onClick={() => toggleSection('hata')}>
          <Chevron />
          <span className="coverage-section-title">COST-231 Hata</span>
        </div>
        <div className="coverage-section-body">
          {results?.freq === 0 ? (
            <p className="coverage-info">Frequency not available in file metadata</p>
          ) : (
            <>
              <div className="coverage-metrics">
                <div className="coverage-metric">
                  <span className="coverage-metric-label">Max Range</span>
                  <span className="coverage-metric-value">{fmtKm(results?.hata?.maxRange)}</span>
                </div>
                <div className="coverage-metric">
                  <span className="coverage-metric-label">Path Loss</span>
                  <span className="coverage-metric-value">{fmt(results?.hata?.pathLossAtMaxRange, 1, ' dB')}</span>
                </div>
                <div className="coverage-metric">
                  <span className="coverage-metric-label">Env. Corr. (Cm)</span>
                  <span className="coverage-metric-value">{fmt(results?.hata?.environmentCorrection, 0, ' dB')}</span>
                </div>
                <div className="coverage-metric">
                  <span className="coverage-metric-label">Mobile Corr.</span>
                  <span className="coverage-metric-value">{fmt(results?.hata?.mobileCorrection, 1, ' dB')}</span>
                </div>
              </div>
              {results?.hata && !results.hata.valid && results.hata.validationMessage && (
                <p className="coverage-warning">{results.hata.validationMessage}</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Coverage Area */}
      <div className={`coverage-section ${expanded.area ? 'expanded' : ''}`}>
        <div className="coverage-section-header" onClick={() => toggleSection('area')}>
          <Chevron />
          <span className="coverage-section-title">Coverage Area</span>
        </div>
        <div className="coverage-section-body">
          <div className="coverage-metrics">
            <div className="coverage-metric">
              <span className="coverage-metric-label">Inner Radius</span>
              <span className="coverage-metric-value">{fmtKm(results?.area?.innerRadius)}</span>
            </div>
            <div className="coverage-metric">
              <span className="coverage-metric-label">Outer Radius</span>
              <span className="coverage-metric-value">{fmtKm(results?.area?.outerRadius)}</span>
            </div>
            <div className="coverage-metric">
              <span className="coverage-metric-label">Sector Angle</span>
              <span className="coverage-metric-value">{fmt(results?.area?.sectorAngle, 1, '\u00B0')}</span>
            </div>
            <div className="coverage-metric">
              <span className="coverage-metric-label">Sector Area</span>
              <span className="coverage-metric-value">{fmt(results?.area?.sectorArea, 2, ' km\u00B2')}</span>
            </div>
          </div>
        </div>
      </div>

      <p className="coverage-disclaimer">
        Estimates assume flat terrain and no obstacles. Actual coverage varies with terrain, clutter, and conditions.
      </p>
    </div>
  );
}
