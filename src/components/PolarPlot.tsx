import { forwardRef, useImperativeHandle, useRef } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-expect-error plotly.js-dist-min has no type declarations
import Plotly from 'plotly.js-dist-min';
import type { MsiFile } from '../types/msi';
import type { SidelobeResult } from '../lib/sidelobeAnalysis';
import './PolarPlot.css';

const Plot = createPlotlyComponent(Plotly);

interface PolarPlotProps {
  files: MsiFile[];
  patternKey: 'horizontal' | 'vertical';
  title: string;
  sidelobeData?: Map<string, { h: SidelobeResult | null; v: SidelobeResult | null }>;
  showSidelobeMarkers?: boolean;
  envelopeFile?: MsiFile;
  revision?: number;
}

export interface PolarPlotHandle {
  toImage: (opts?: { width?: number; height?: number }) => Promise<string>;
}

const PolarPlot = forwardRef<PolarPlotHandle, PolarPlotProps>(
  function PolarPlot({ files, patternKey, title, sidelobeData, showSidelobeMarkers, envelopeFile, revision }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      async toImage(opts = {}) {
        const el = containerRef.current?.querySelector('.js-plotly-plot');
        if (!el) throw new Error('Plot element not found');
        return Plotly.toImage(el, {
          format: 'png',
          width: opts.width ?? 1200,
          height: opts.height ?? 900,
        }) as Promise<string>;
      },
    }));

    const maxR = 40;

    const traces = files.map(file => {
      const pattern = file[patternKey];

      // ── Build a 360-element lookup of loss values by original angle ──
      const lossByAngle = new Float64Array(360).fill(0);
      for (const p of pattern) {
        const idx = ((Math.round(p.angleDeg) % 360) + 360) % 360;
        lossByAngle[idx] = p.lossdB;
      }

      // ── Compute the absolute shift for this file ──
      // The chart's angularaxis.rotation=90 places 0° at North and adds +90°
      // to all data theta values. We subtract 90 from each shift to compensate.
      const adj = file.adjustments;
      let shift: number;
      if (patternKey === 'horizontal') {
        // H: boresight at compass 0° (North). Positive azimuth rotates CW.
        // shift = azimuth - 90 (compensate for rotation:90 adding 90°)
        const azimuth = adj?.azimuthRotation ?? 0;
        shift = Math.round(((azimuth - 90 + 360) % 360));
      } else {
        // V: horizon at compass 90° (Right). Positive tilt rotates CW (downward).
        // Total_Tilt = Mech_Downtilt + Base_Electrical_Tilt + Elec_Tilt_Delta
        // shift = totalTilt (rotation:90 adds the 90° for horizon)
        const baseTilt = parseFloat(file.metadata?.electricalTilt) || 0;
        const totalTilt = (adj?.mechanicalDowntilt ?? 0)
                        + baseTilt
                        + (adj?.electricalTiltDelta ?? 0);
        shift = Math.round(((totalTilt % 360) + 360) % 360);
      }

      // ── Absolute array remap: physically place each value at its chart angle ──
      const theta: number[] = [];
      const r: number[] = [];
      for (let i = 0; i < 360; i++) {
        const originalIndex = ((i - shift) % 360 + 360) % 360;
        theta.push(i);
        r.push(Math.max(0, maxR - lossByAngle[originalIndex]));
      }

      const displayName = file.metadata.name || file.fileName;
      const truncated = displayName.length > 30
        ? displayName.slice(0, 28) + '...'
        : displayName;

      return {
        type: 'scatterpolar' as const,
        mode: 'lines' as const,
        name: truncated,
        theta: [...theta, theta[0]],
        r: [...r, r[0]],
        line: { color: file.color, width: 1.5 },
      };
    });

    // Add sidelobe/null markers if enabled
    if (showSidelobeMarkers && sidelobeData) {
      for (const file of files) {
        const sl = sidelobeData.get(file.id);
        const result = sl?.[patternKey === 'horizontal' ? 'h' : 'v'];
        if (!result) continue;

        // Same shift formula as main traces (compensating for rotation:90)
        const adj = file.adjustments;
        let shift: number;
        if (patternKey === 'horizontal') {
          shift = Math.round((((adj?.azimuthRotation ?? 0) - 90 + 360) % 360));
        } else {
          const baseTilt = parseFloat(file.metadata?.electricalTilt) || 0;
          const totalTilt = (adj?.mechanicalDowntilt ?? 0) + baseTilt + (adj?.electricalTiltDelta ?? 0);
          shift = Math.round(((totalTilt % 360) + 360) % 360);
        }

        // Sidelobe markers (triangles) — remap angle
        if (result.sidelobes.length > 0) {
          traces.push({
            type: 'scatterpolar' as const,
            mode: 'markers' as const,
            name: 'Sidelobes',
            theta: result.sidelobes.map(s => ((Math.round(s.angleDeg) + shift) % 360 + 360) % 360),
            r: result.sidelobes.map(s => Math.max(0, maxR - s.lossdB)),
            marker: { color: file.color, symbol: 'triangle-up', size: 8, line: { width: 1, color: '#fff' } },
            showlegend: false,
          } as unknown as typeof traces[0]);
        }

        // Null markers (circles) — remap angle
        if (result.nulls.length > 0) {
          traces.push({
            type: 'scatterpolar' as const,
            mode: 'markers' as const,
            name: 'Nulls',
            theta: result.nulls.map(n => ((Math.round(n.angleDeg) + shift) % 360 + 360) % 360),
            r: result.nulls.map(n => Math.max(0, maxR - n.lossdB)),
            marker: { color: file.color, symbol: 'circle-open', size: 8, line: { width: 2 } },
            showlegend: false,
          } as unknown as typeof traces[0]);
        }
      }
    }

    // Add envelope overlay trace if provided
    if (envelopeFile) {
      const envPattern = envelopeFile[patternKey];
      const envLoss = new Float64Array(360).fill(0);
      for (const p of envPattern) {
        const idx = ((Math.round(p.angleDeg) % 360) + 360) % 360;
        envLoss[idx] = p.lossdB;
      }
      // No adjustments — envelope is computed from already-adjusted data.
      // Compensate for angularaxis.rotation=90 by subtracting 90.
      const envTheta: number[] = [];
      const envR: number[] = [];
      for (let i = 0; i < 360; i++) {
        envTheta.push(((i - 90 + 360) % 360));
        envR.push(Math.max(0, maxR - envLoss[i]));
      }
      traces.push({
        type: 'scatterpolar' as const,
        mode: 'lines' as const,
        name: 'Envelope',
        theta: [...envTheta, envTheta[0]],
        r: [...envR, envR[0]],
        line: { color: '#FFD700', width: 3, dash: 'dot' },
        fill: 'toself',
        fillcolor: 'rgba(255, 215, 0, 0.08)',
      } as unknown as typeof traces[0]);
    }

    const layout = {
      title: {
        text: title,
        font: { color: '#e0e0e8', size: 13, family: 'Inter, sans-serif' },
      },
      polar: {
        bgcolor: 'rgba(26, 26, 36, 0.4)',
        radialaxis: {
          visible: true,
          range: [0, 40],
          tickvals: [0, 10, 20, 30, 40],
          ticktext: ['-40 dB', '-30 dB', '-20 dB', '-10 dB', '0 dB'],
          color: '#9a9ab0',
          gridcolor: 'rgba(255, 255, 255, 0.1)',
          linecolor: 'rgba(255, 255, 255, 0.1)',
          tickfont: { size: 9, color: '#6a6a80' },
          angle: 90,
        },
        angularaxis: {
          direction: 'clockwise' as const,
          rotation: 90,
          color: '#9a9ab0',
          gridcolor: 'rgba(255, 255, 255, 0.1)',
          linecolor: 'rgba(255, 255, 255, 0.1)',
          tickfont: { size: 10, color: '#9a9ab0' },
          dtick: 30,
        },
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#e0e0e8', family: 'Inter, sans-serif' },
      margin: { t: 50, r: 40, b: 40, l: 40 },
      showlegend: files.length > 1 || !!envelopeFile,
      legend: {
        font: { color: '#9a9ab0', size: 9 },
        bgcolor: 'rgba(26, 26, 36, 0.9)',
        bordercolor: 'rgba(255, 255, 255, 0.1)',
        borderwidth: 1,
        x: 0,
        y: 1,
        xanchor: 'left' as const,
        yanchor: 'top' as const,
        itemwidth: 20,
      },
    };

    const config: Record<string, unknown> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d', 'autoScale2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: `${title.toLowerCase().replace(/\s+/g, '_')}_pattern`,
        width: 800,
        height: 800,
      },
    };

    return (
      <div className="polar-plot-container" ref={containerRef}>
        <Plot
          data={traces}
          layout={layout}
          config={config}
          revision={revision}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    );
  }
);

export default PolarPlot;
