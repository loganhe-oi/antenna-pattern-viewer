import { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-expect-error plotly.js-dist-min has no type declarations
import Plotly from 'plotly.js-dist-min';
import type { MsiFile } from '../types/msi';
import { generateSurface3D, generate3DWireframe } from '../lib/pattern3d';
import './ThreeDPlot.css';

const Plot = createPlotlyComponent(Plotly);

export interface ThreeDPlotHandle {
  toImage: (opts?: { width?: number; height?: number }) => Promise<string>;
}

interface ThreeDPlotProps {
  files: MsiFile[];
  envelopeFile?: MsiFile;
}

const ThreeDPlot = forwardRef<ThreeDPlotHandle, ThreeDPlotProps>(
  function ThreeDPlot({ files, envelopeFile }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(ref, () => ({
      async toImage(opts = {}) {
        const el = containerRef.current?.querySelector('.js-plotly-plot');
        if (!el) throw new Error('3D plot element not found');
        return Plotly.toImage(el, {
          format: 'png',
          width: opts.width ?? 1200,
          height: opts.height ?? 900,
        }) as Promise<string>;
      },
    }));

    const traces = useMemo(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any[];

      if (files.length === 1) {
        // Single antenna: surface plot
        const file = files[0];
        const adj = file.adjustments;
        const baseTilt = parseFloat(file.metadata?.electricalTilt) || 0;
        const surface = generateSurface3D(file.horizontal, file.vertical, 2, {
          azimuthRotation: adj?.azimuthRotation ?? 0,
          mechDowntilt: adj?.mechanicalDowntilt ?? 0,
          totalElecTilt: baseTilt + (adj?.electricalTiltDelta ?? 0),
        });
        // surfacecolor is already normalizedGain (0 dB = peak = Red, negative = Blue)
        // z already uses RF convention (positive downtilt → −Z)
        result = [{
          type: 'surface' as const,
          x: surface.x,
          y: surface.y,
          z: surface.z,
          surfacecolor: surface.surfacecolor,
          colorscale: 'Jet',
          colorbar: {
            title: { text: 'Relative Gain (dB)', font: { size: 10 } },
            tickfont: { size: 9 },
            len: 0.6,
          },
          name: file.metadata.name || file.fileName,
          showlegend: false,
        }];
      } else {
        // Multiple antennas: wireframe per file
        result = files.map(file => {
          const adj = file.adjustments;
          const baseTilt = parseFloat(file.metadata?.electricalTilt) || 0;
          const wf = generate3DWireframe(file.horizontal, file.vertical, {
            azimuthRotation: adj?.azimuthRotation ?? 0,
            mechDowntilt: adj?.mechanicalDowntilt ?? 0,
            totalElecTilt: baseTilt + (adj?.electricalTiltDelta ?? 0),
          });
          const displayName = file.metadata.name || file.fileName;
          const truncated = displayName.length > 30
            ? displayName.slice(0, 28) + '...'
            : displayName;
          return {
            type: 'scatter3d' as const,
            mode: 'lines' as const,
            x: wf.x,
            y: wf.y,
            z: wf.z,
            line: { color: file.color, width: 2 },
            name: truncated,
          };
        });
      }

      // Append envelope surface if provided
      if (envelopeFile) {
        const envSurface = generateSurface3D(envelopeFile.horizontal, envelopeFile.vertical, 2);
        result.push({
          type: 'surface' as const,
          x: envSurface.x,
          y: envSurface.y,
          z: envSurface.z,
          surfacecolor: envSurface.surfacecolor,
          colorscale: [
            [0, 'rgba(255, 215, 0, 0.0)'],
            [1, 'rgba(255, 215, 0, 0.4)'],
          ] as [number, string][],
          opacity: 0.3,
          showscale: false,
          name: 'Envelope',
          showlegend: true,
        });
      }

      return result;
    }, [files, envelopeFile]);

    const layout = {
      title: {
        text: files.length === 1
          ? `3D Pattern: ${files[0].metadata.name || files[0].fileName}`
          : '3D Pattern Comparison',
        font: { color: '#e0e0e8', size: 13, family: 'Inter, sans-serif' },
      },
      scene: {
        xaxis: { title: { text: 'X' }, showgrid: true, gridcolor: 'rgba(255,255,255,0.1)', range: [-44, 44], autorange: false },
        yaxis: { title: { text: 'Y' }, showgrid: true, gridcolor: 'rgba(255,255,255,0.1)', range: [-44, 44], autorange: false },
        zaxis: { title: { text: 'Z' }, showgrid: true, gridcolor: 'rgba(255,255,255,0.1)', range: [-44, 44], autorange: false },
        camera: { eye: { x: 1.25, y: 1.25, z: 1.25 } },
        aspectmode: 'cube' as const,
      },
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: '#e0e0e8', family: 'Inter, sans-serif' },
      margin: { l: 0, r: 0, b: 0, t: 40 },
      showlegend: files.length > 1 || !!envelopeFile,
      legend: {
        font: { color: '#9a9ab0', size: 9 },
        bgcolor: 'rgba(26, 26, 36, 0.9)',
        bordercolor: 'rgba(255, 255, 255, 0.1)',
        borderwidth: 1,
      },
    };

    const config: Record<string, unknown> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
    };

    return (
      <div className="three-d-plot-container" ref={containerRef}>
        <Plot
          data={traces}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%', minHeight: '600px' }}
          useResizeHandler
        />
      </div>
    );
  }
);

export default ThreeDPlot;
