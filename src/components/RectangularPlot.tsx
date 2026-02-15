import { forwardRef, useImperativeHandle, useRef } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-expect-error plotly.js-dist-min has no type declarations
import Plotly from 'plotly.js-dist-min';
import type { MsiFile } from '../types/msi';
import type { SidelobeResult } from '../lib/sidelobeAnalysis';
import './RectangularPlot.css';

const Plot = createPlotlyComponent(Plotly);

interface RectangularPlotProps {
  files: MsiFile[];
  patternKey: 'horizontal' | 'vertical';
  title: string;
  absoluteMode: boolean;
  sidelobeData?: Map<string, { h: SidelobeResult | null; v: SidelobeResult | null }>;
  showSidelobeMarkers?: boolean;
  envelopeFile?: MsiFile;
  revision?: number;
}

export interface RectangularPlotHandle {
  toImage: (opts?: { width?: number; height?: number }) => Promise<string>;
}

const RectangularPlot = forwardRef<RectangularPlotHandle, RectangularPlotProps>(
  function RectangularPlot({ files, patternKey, title, absoluteMode, sidelobeData, showSidelobeMarkers, envelopeFile, revision }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      async toImage(opts = {}) {
        const el = containerRef.current?.querySelector('.js-plotly-plot');
        if (!el) throw new Error('Plot element not found');
        return Plotly.toImage(el, {
          format: 'png',
          width: opts.width ?? 1400,
          height: opts.height ?? 500,
        }) as Promise<string>;
      },
    }));

    const traces = files.map(file => {
      const pattern = file[patternKey];
      const gain = parseFloat(file.metadata.gain) || 0;

      // ── Remap X-axis to -180° … +180° ──
      // H: 0-180 stays, 181-359 becomes -179 to -1
      // V: subtract 90 so 90° (horizon in polar data) becomes 0° (horizon)
      const mapped = pattern.map(p => {
        let newX: number;
        if (patternKey === 'horizontal') {
          newX = p.angleDeg <= 180 ? p.angleDeg : p.angleDeg - 360;
        } else {
          newX = p.angleDeg - 90;
          if (newX > 180) newX -= 360;
          if (newX < -180) newX += 360;
        }
        return {
          x: newX,
          y: absoluteMode ? gain - p.lossdB : p.lossdB,
        };
      });

      // Sort by X so the line draws continuously left-to-right
      mapped.sort((a, b) => a.x - b.x);

      const displayName = file.metadata.name || file.fileName;
      const truncated = displayName.length > 30
        ? displayName.slice(0, 28) + '...'
        : displayName;

      return {
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: truncated,
        x: mapped.map(m => m.x),
        y: mapped.map(m => m.y),
        line: { color: file.color, width: 1.5 },
        hovertemplate: absoluteMode
          ? 'Angle: %{x}\u00B0<br>%{y:.1f} dBi<extra></extra>'
          : 'Angle: %{x}\u00B0<br>%{y:.1f} dB<extra></extra>',
      };
    });

    // Add sidelobe/null markers
    if (showSidelobeMarkers && sidelobeData) {
      for (const file of files) {
        const sl = sidelobeData.get(file.id);
        const result = sl?.[patternKey === 'horizontal' ? 'h' : 'v'];
        if (!result) continue;
        const gain = parseFloat(file.metadata.gain) || 0;

        // Remap marker angles to -180…+180 (same logic as traces)
        const remapAngle = (a: number) => {
          if (patternKey === 'horizontal') {
            return a <= 180 ? a : a - 360;
          }
          let newX = a - 90;
          if (newX > 180) newX -= 360;
          if (newX < -180) newX += 360;
          return newX;
        };

        if (result.sidelobes.length > 0) {
          traces.push({
            type: 'scatter' as const,
            mode: 'markers' as const,
            name: 'Sidelobes',
            x: result.sidelobes.map(s => remapAngle(s.angleDeg)),
            y: absoluteMode
              ? result.sidelobes.map(s => gain - s.lossdB)
              : result.sidelobes.map(s => s.lossdB),
            marker: { color: file.color, symbol: 'triangle-up', size: 8, line: { width: 1, color: '#fff' } },
            showlegend: false,
            hovertemplate: 'Sidelobe %{x}\u00B0<br>%{y:.1f} dB<extra></extra>',
          } as unknown as typeof traces[0]);
        }

        if (result.nulls.length > 0) {
          traces.push({
            type: 'scatter' as const,
            mode: 'markers' as const,
            name: 'Nulls',
            x: result.nulls.map(n => remapAngle(n.angleDeg)),
            y: absoluteMode
              ? result.nulls.map(n => gain - n.lossdB)
              : result.nulls.map(n => n.lossdB),
            marker: { color: file.color, symbol: 'circle-open', size: 8, line: { width: 2 } },
            showlegend: false,
            hovertemplate: 'Null %{x}\u00B0<br>%{y:.1f} dB<extra></extra>',
          } as unknown as typeof traces[0]);
        }
      }
    }

    // Add envelope overlay trace if provided
    if (envelopeFile) {
      const envPattern = envelopeFile[patternKey];
      const envGain = parseFloat(envelopeFile.metadata.gain) || 0;

      const envMapped = envPattern.map(p => {
        let newX: number;
        if (patternKey === 'horizontal') {
          newX = p.angleDeg <= 180 ? p.angleDeg : p.angleDeg - 360;
        } else {
          newX = p.angleDeg - 90;
          if (newX > 180) newX -= 360;
          if (newX < -180) newX += 360;
        }
        return {
          x: newX,
          y: absoluteMode ? envGain - p.lossdB : p.lossdB,
        };
      });
      envMapped.sort((a, b) => a.x - b.x);

      traces.push({
        type: 'scatter' as const,
        mode: 'lines' as const,
        name: 'Envelope',
        x: envMapped.map(m => m.x),
        y: envMapped.map(m => m.y),
        line: { color: '#FFD700', width: 3, dash: 'dot' },
        fill: 'tozeroy',
        fillcolor: 'rgba(255, 215, 0, 0.08)',
        hovertemplate: absoluteMode
          ? 'Envelope %{x}\u00B0<br>%{y:.1f} dBi<extra></extra>'
          : 'Envelope %{x}\u00B0<br>%{y:.1f} dB<extra></extra>',
      } as unknown as typeof traces[0]);
    }

    const layout = {
      title: {
        text: title,
        font: { color: '#e0e0e8', size: 13, family: 'Inter, sans-serif' },
      },
      xaxis: {
        title: { text: 'Angle (\u00B0)', font: { size: 11, color: '#9a9ab0' } },
        range: [-180, 180],
        tickvals: [-180, -90, 0, 90, 180],
        gridcolor: 'rgba(255, 255, 255, 0.1)',
        linecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { size: 10, color: '#9a9ab0' },
        zeroline: true,
        zerolinecolor: 'rgba(255, 255, 255, 0.15)',
      },
      yaxis: {
        title: {
          text: absoluteMode ? 'Gain (dBi)' : 'Attenuation (dB)',
          font: { size: 11, color: '#9a9ab0' },
        },
        dtick: 5,
        autorange: absoluteMode ? true : 'reversed' as const,
        gridcolor: 'rgba(255, 255, 255, 0.1)',
        linecolor: 'rgba(255, 255, 255, 0.1)',
        tickfont: { size: 10, color: '#9a9ab0' },
        zeroline: false,
      },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#e0e0e8', family: 'Inter, sans-serif' },
      margin: { t: 50, r: 30, b: 50, l: 60 },
      showlegend: files.length > 1 || !!envelopeFile,
      legend: {
        font: { color: '#9a9ab0', size: 9 },
        bgcolor: 'rgba(26, 26, 36, 0.9)',
        bordercolor: 'rgba(255, 255, 255, 0.1)',
        borderwidth: 1,
        x: 1,
        y: 1,
        xanchor: 'right' as const,
        yanchor: 'top' as const,
      },
      hovermode: 'x unified' as const,
    };

    const config: Record<string, unknown> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
      toImageButtonOptions: {
        format: 'png',
        filename: `${title.toLowerCase().replace(/\s+/g, '_')}_pattern`,
        width: 1400,
        height: 500,
      },
    };

    return (
      <div className="rectangular-plot-container" ref={containerRef}>
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

export default RectangularPlot;
