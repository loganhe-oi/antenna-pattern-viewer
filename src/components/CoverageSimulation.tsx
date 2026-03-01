import { useMemo } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
// @ts-expect-error plotly.js-dist-min has no type declarations
import Plotly from 'plotly.js-dist-min';
import type { CoverageResults } from '../hooks/useCoverageResults';
import type { CoverageParams } from '../types/coverage';
import {
  createScaleFn,
  buildTowerTrace,
  buildBeamConeTraces,
  buildGroundFootprintTrace,
  buildGroundGridTrace,
  buildDistanceLabels,
} from '../lib/coverageSimTraces';
import './CoverageSimulation.css';

const Plot = createPlotlyComponent(Plotly);

interface CoverageSimulationProps {
  coverageResults: CoverageResults;
  params: CoverageParams;
}

export default function CoverageSimulation({ coverageResults, params }: CoverageSimulationProps) {
  const H = params.antennaHeight;

  const traces = useMemo(() => {
    const scale = createScaleFn(H);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any[] = [];

    // Tower
    result.push(buildTowerTrace(H));

    // Beam cone wireframe
    result.push(...buildBeamConeTraces(coverageResults, H, scale));

    // Ground coverage footprint
    const footprint = buildGroundFootprintTrace(coverageResults, scale);
    if (footprint) result.push(footprint);

    // Reference grid + labels
    const outerR = coverageResults.area
      ? coverageResults.area.outerRadius * 1000
      : coverageResults.beam
        ? coverageResults.beam.outerEdge
        : 1000;
    result.push(buildGroundGridTrace(outerR, scale));
    result.push(buildDistanceLabels(outerR, scale));

    return result;
  }, [coverageResults, H]);

  const scale = createScaleFn(H);
  const outerR = coverageResults.area
    ? coverageResults.area.outerRadius * 1000
    : coverageResults.beam
      ? coverageResults.beam.outerEdge
      : 1000;
  const maxScaled = scale(outerR) * 1.3;

  const layout = {
    title: {
      text: 'Coverage Simulation',
      font: { color: '#e0e0e8', size: 13, family: 'var(--font-mono), monospace' },
    },
    scene: {
      xaxis: {
        title: { text: '' },
        showgrid: true,
        gridcolor: 'rgba(255,255,255,0.05)',
        range: [-maxScaled, maxScaled],
        showticklabels: false,
      },
      yaxis: {
        title: { text: '' },
        showgrid: true,
        gridcolor: 'rgba(255,255,255,0.05)',
        range: [-maxScaled * 0.3, maxScaled],
        showticklabels: false,
      },
      zaxis: {
        title: { text: 'Height (m)' },
        showgrid: true,
        gridcolor: 'rgba(255,255,255,0.08)',
        range: [0, H * 1.5],
      },
      camera: { eye: { x: 1.5, y: -1.5, z: 0.8 } },
      aspectmode: 'manual' as const,
      aspectratio: { x: 1, y: 1.5, z: 0.4 },
    },
    autosize: true,
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: '#e0e0e8', family: 'var(--font-mono), monospace' },
    margin: { l: 0, r: 0, b: 0, t: 40 },
    showlegend: true,
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
    <div className="coverage-sim-container">
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
