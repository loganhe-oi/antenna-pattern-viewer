import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MsiFile } from '../types/msi';
import type { CoverageParams } from '../types/coverage';
import type { CoverageResults } from '../hooks/useCoverageResults';
import { analyzeSidelobes, type SidelobeResult } from '../lib/sidelobeAnalysis';
import { computeEnvelope } from '../lib/envelope';
import PolarPlot from './PolarPlot';
import type { PolarPlotHandle } from './PolarPlot';
import RectangularPlot from './RectangularPlot';
import type { RectangularPlotHandle } from './RectangularPlot';
import ThreeDPlot from './ThreeDPlot';
import type { ThreeDPlotHandle } from './ThreeDPlot';
import CoverageSimulation from './CoverageSimulation';
import SidelobePanel from './SidelobePanel';
import './PatternView.css';

interface PatternViewProps {
  files: MsiFile[];
  selectedFile?: MsiFile | null;
  coverageResults?: CoverageResults | null;
  coverageParams?: CoverageParams;
}

export interface PatternViewHandle {
  exportImages: () => Promise<{
    horizontal: string;
    vertical: string;
    rectHorizontal?: string;
    rectVertical?: string;
    threeDImage?: string;
  }>;
}

const PatternView = forwardRef<PatternViewHandle, PatternViewProps>(
  function PatternView({ files, selectedFile, coverageResults, coverageParams }, ref) {
    const [viewMode, setViewMode] = useState<'polar' | 'rectangular' | '3d' | 'simulation'>('polar');
    const [absoluteMode, setAbsoluteMode] = useState(false);
    const [showSidelobes, setShowSidelobes] = useState(false);
    const [showEnvelope, setShowEnvelope] = useState(false);

    const hRef = useRef<PolarPlotHandle>(null);
    const vRef = useRef<PolarPlotHandle>(null);
    const hRectRef = useRef<RectangularPlotHandle>(null);
    const vRectRef = useRef<RectangularPlotHandle>(null);
    const threeDRef = useRef<ThreeDPlotHandle>(null);

    // Compute a revision counter that changes whenever file data changes.
    // This forces react-plotly.js to re-render when adjustments are applied.
    const revision = useMemo(() => {
      let hash = 0;
      for (const f of files) {
        for (const p of f.horizontal.slice(0, 5)) hash += p.lossdB;
        for (const p of f.vertical.slice(0, 5)) hash += p.lossdB;
        if (f.adjustments) {
          hash += f.adjustments.mechanicalDowntilt * 1000;
          hash += f.adjustments.electricalTiltDelta * 100;
          hash += f.adjustments.azimuthRotation;
        }
      }
      if (showEnvelope) hash += 7777;
      return hash;
    }, [files, showEnvelope]);

    const sidelobeData = useMemo(() => {
      if (!showSidelobes) return undefined;
      const map = new Map<string, { h: SidelobeResult | null; v: SidelobeResult | null }>();
      for (const f of files) {
        map.set(f.id, {
          h: analyzeSidelobes(f.horizontal),
          v: analyzeSidelobes(f.vertical),
        });
      }
      return map;
    }, [files, showSidelobes]);

    const envelopeFile = useMemo(() => {
      if (!showEnvelope || files.length < 2) return undefined;
      return computeEnvelope(files, '#FFD700');
    }, [files, showEnvelope]);

    useImperativeHandle(ref, () => ({
      async exportImages() {
        const [h, v] = await Promise.all([
          hRef.current!.toImage({ width: 1200, height: 900 }),
          vRef.current!.toImage({ width: 1200, height: 900 }),
        ]);

        let rectH: string | undefined;
        let rectV: string | undefined;
        if (hRectRef.current && vRectRef.current) {
          [rectH, rectV] = await Promise.all([
            hRectRef.current.toImage({ width: 1400, height: 500 }),
            vRectRef.current.toImage({ width: 1400, height: 500 }),
          ]);
        }

        let threeDImage: string | undefined;
        if (threeDRef.current) {
          threeDImage = await threeDRef.current.toImage({ width: 1200, height: 900 });
        }

        return { horizontal: h, vertical: v, rectHorizontal: rectH, rectVertical: rectV, threeDImage };
      },
    }));

    if (files.length === 0) {
      return (
        <div className="pattern-view-empty">
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v10" />
              <path d="M6 8l6 4 6-4" />
              <path d="M3 14l9 6 9-6" />
              <circle cx="12" cy="2" r="1" fill="currentColor" />
            </svg>
            <h2>No Patterns Loaded</h2>
            <p>Drop .msi antenna pattern files into the upload area to begin.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="pattern-view-wrapper">
        <div className="view-tabs">
          <button
            className={viewMode === 'polar' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setViewMode('polar')}
          >
            Polar
          </button>
          <button
            className={viewMode === 'rectangular' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setViewMode('rectangular')}
          >
            Rectangular
          </button>
          <button
            className={viewMode === '3d' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setViewMode('3d')}
          >
            3D
          </button>
          <button
            className={viewMode === 'simulation' ? 'tab-btn active' : 'tab-btn'}
            onClick={() => setViewMode('simulation')}
          >
            Coverage Simulation
          </button>
          {viewMode === 'rectangular' && (
            <label className="abs-toggle">
              <input
                type="checkbox"
                checked={absoluteMode}
                onChange={e => setAbsoluteMode(e.target.checked)}
              />
              Absolute (dBi)
            </label>
          )}
          <label className="abs-toggle">
            <input
              type="checkbox"
              checked={showSidelobes}
              onChange={e => setShowSidelobes(e.target.checked)}
            />
            Sidelobes
          </label>
          {files.length >= 2 && (
            <label className="abs-toggle">
              <input
                type="checkbox"
                checked={showEnvelope}
                onChange={e => setShowEnvelope(e.target.checked)}
              />
              Envelope
            </label>
          )}
        </div>

        {showSidelobes && selectedFile && <SidelobePanel file={selectedFile} />}

        {/* Polar view — always in DOM for export, hidden when not active */}
        <div className={`pattern-view ${viewMode !== 'polar' ? 'view-hidden' : ''}`}>
          <PolarPlot ref={hRef} files={files} patternKey="horizontal" title="Horizontal Pattern (Azimuth)" sidelobeData={sidelobeData} showSidelobeMarkers={showSidelobes} envelopeFile={envelopeFile} revision={revision} />
          <PolarPlot ref={vRef} files={files} patternKey="vertical" title="Vertical Pattern (Elevation)" sidelobeData={sidelobeData} showSidelobeMarkers={showSidelobes} envelopeFile={envelopeFile} revision={revision} />
        </div>

        {/* Rectangular view */}
        {viewMode === 'rectangular' && (
          <div className="pattern-view pattern-view-rect">
            <RectangularPlot ref={hRectRef} files={files} patternKey="horizontal" title="Horizontal Pattern (Azimuth)" absoluteMode={absoluteMode} sidelobeData={sidelobeData} showSidelobeMarkers={showSidelobes} envelopeFile={envelopeFile} revision={revision} />
            <RectangularPlot ref={vRectRef} files={files} patternKey="vertical" title="Vertical Pattern (Elevation)" absoluteMode={absoluteMode} sidelobeData={sidelobeData} showSidelobeMarkers={showSidelobes} envelopeFile={envelopeFile} revision={revision} />
          </div>
        )}

        {/* 3D view */}
        {viewMode === '3d' && (
          <div className="pattern-view pattern-view-3d">
            <ThreeDPlot ref={threeDRef} files={files} envelopeFile={envelopeFile} />
          </div>
        )}

        {/* Coverage simulation view */}
        {viewMode === 'simulation' && (
          <div className="pattern-view pattern-view-3d">
            {coverageResults && coverageParams ? (
              <CoverageSimulation coverageResults={coverageResults} params={coverageParams} />
            ) : (
              <div className="pattern-view-empty">
                <div className="empty-state">
                  <h2>No Coverage Data</h2>
                  <p>Select a file and configure coverage parameters in the sidebar panel.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

export default PatternView;
