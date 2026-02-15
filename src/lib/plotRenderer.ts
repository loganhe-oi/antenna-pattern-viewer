// @ts-expect-error plotly.js-dist-min has no type declarations
import Plotly from 'plotly.js-dist-min';
import type { MsiFile } from '../types/msi';
import { generateSurface3D, generate3DWireframe } from './pattern3d';

interface RenderOptions {
  width: number;
  height: number;
}

async function renderToImage(
  traces: object[],
  layout: object,
  opts: RenderOptions,
): Promise<string> {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.left = '-9999px';
  div.style.width = opts.width + 'px';
  div.style.height = opts.height + 'px';
  document.body.appendChild(div);
  try {
    await Plotly.newPlot(div, traces, layout, { staticPlot: true });
    return await Plotly.toImage(div, {
      format: 'png',
      width: opts.width,
      height: opts.height,
    }) as string;
  } finally {
    Plotly.purge(div);
    document.body.removeChild(div);
  }
}

function buildPolarTraces(files: MsiFile[], patternKey: 'horizontal' | 'vertical') {
  return files.map(file => {
    const pattern = file[patternKey];
    const maxR = 40;
    const theta = pattern.map(p => p.angleDeg);
    const r = pattern.map(p => Math.max(0, maxR - p.lossdB));
    const displayName = file.metadata.name || file.fileName;

    return {
      type: 'scatterpolar',
      mode: 'lines',
      name: displayName,
      theta: [...theta, theta[0]],
      r: [...r, r[0]],
      line: { color: file.color, width: 2 },
    };
  });
}

function buildPolarLayout(title: string) {
  return {
    title: { text: title, font: { color: '#e0e0e8', size: 14, family: 'Helvetica, sans-serif' } },
    polar: {
      bgcolor: 'rgba(26, 26, 36, 0.4)',
      radialaxis: {
        visible: true,
        range: [0, 40],
        tickvals: [0, 10, 20, 30, 40],
        ticktext: ['-40 dB', '-30 dB', '-20 dB', '-10 dB', '0 dB'],
        color: '#9a9ab0',
        gridcolor: 'rgba(255,255,255,0.1)',
        linecolor: 'rgba(255,255,255,0.1)',
        tickfont: { size: 9, color: '#6a6a80' },
        angle: 90,
      },
      angularaxis: {
        direction: 'clockwise',
        rotation: 90,
        color: '#9a9ab0',
        gridcolor: 'rgba(255,255,255,0.1)',
        linecolor: 'rgba(255,255,255,0.1)',
        tickfont: { size: 10, color: '#9a9ab0' },
        dtick: 30,
      },
    },
    paper_bgcolor: '#121218',
    plot_bgcolor: '#121218',
    font: { color: '#e0e0e8', family: 'Helvetica, sans-serif' },
    margin: { t: 50, r: 40, b: 40, l: 40 },
    showlegend: false,
    legend: { font: { color: '#9a9ab0', size: 9 } },
  };
}

function buildRectTraces(files: MsiFile[], patternKey: 'horizontal' | 'vertical') {
  return files.map(file => {
    const pattern = file[patternKey];
    const displayName = file.metadata.name || file.fileName;

    return {
      type: 'scatter',
      mode: 'lines',
      name: displayName,
      x: pattern.map(p => p.angleDeg),
      y: pattern.map(p => p.lossdB),
      line: { color: file.color, width: 2 },
    };
  });
}

function buildRectLayout(title: string) {
  return {
    title: { text: title, font: { color: '#e0e0e8', size: 14, family: 'Helvetica, sans-serif' } },
    xaxis: {
      title: { text: 'Angle (\u00B0)', font: { size: 11, color: '#9a9ab0' } },
      range: [0, 360],
      dtick: 30,
      gridcolor: 'rgba(255,255,255,0.1)',
      linecolor: 'rgba(255,255,255,0.1)',
      tickfont: { size: 10, color: '#9a9ab0' },
      zeroline: false,
    },
    yaxis: {
      title: { text: 'Attenuation (dB)', font: { size: 11, color: '#9a9ab0' } },
      dtick: 5,
      autorange: 'reversed',
      gridcolor: 'rgba(255,255,255,0.1)',
      linecolor: 'rgba(255,255,255,0.1)',
      tickfont: { size: 10, color: '#9a9ab0' },
      zeroline: false,
    },
    paper_bgcolor: '#121218',
    plot_bgcolor: '#121218',
    font: { color: '#e0e0e8', family: 'Helvetica, sans-serif' },
    margin: { t: 50, r: 30, b: 50, l: 60 },
    showlegend: false,
  };
}

export async function renderPolarToImage(
  files: MsiFile[],
  patternKey: 'horizontal' | 'vertical',
  opts: RenderOptions,
): Promise<string> {
  const title = patternKey === 'horizontal'
    ? 'Horizontal Pattern (Azimuth)'
    : 'Vertical Pattern (Elevation)';
  const traces = buildPolarTraces(files, patternKey);
  const layout = buildPolarLayout(title);
  if (files.length > 1) {
    (layout as Record<string, unknown>).showlegend = true;
  }
  return renderToImage(traces, layout, opts);
}

export async function renderRectangularToImage(
  files: MsiFile[],
  patternKey: 'horizontal' | 'vertical',
  opts: RenderOptions,
): Promise<string> {
  const title = patternKey === 'horizontal'
    ? 'Horizontal Pattern (Azimuth)'
    : 'Vertical Pattern (Elevation)';
  const traces = buildRectTraces(files, patternKey);
  const layout = buildRectLayout(title);
  if (files.length > 1) {
    (layout as Record<string, unknown>).showlegend = true;
  }
  return renderToImage(traces, layout, opts);
}

export async function render3DToImage(
  files: MsiFile[],
  opts: RenderOptions,
): Promise<string> {
  let traces: object[];

  if (files.length === 1) {
    const file = files[0];
    const surface = generateSurface3D(file.horizontal, file.vertical, 3);
    traces = [{
      type: 'surface',
      x: surface.x,
      y: surface.y,
      z: surface.z,
      surfacecolor: surface.surfacecolor,
      colorscale: 'Jet',
      showlegend: false,
    }];
  } else {
    traces = files.map(file => {
      const wf = generate3DWireframe(file.horizontal, file.vertical);
      return {
        type: 'scatter3d',
        mode: 'lines',
        x: wf.x,
        y: wf.y,
        z: wf.z,
        line: { color: file.color, width: 2 },
        name: file.metadata.name || file.fileName,
      };
    });
  }

  const layout = {
    title: { text: '3D Pattern', font: { color: '#e0e0e8', size: 14, family: 'Helvetica, sans-serif' } },
    scene: {
      xaxis: { title: 'X', gridcolor: 'rgba(255,255,255,0.1)' },
      yaxis: { title: 'Y', gridcolor: 'rgba(255,255,255,0.1)' },
      zaxis: { title: 'Z', gridcolor: 'rgba(255,255,255,0.1)' },
      camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
      aspectmode: 'data',
    },
    paper_bgcolor: '#121218',
    plot_bgcolor: '#121218',
    font: { color: '#e0e0e8', family: 'Helvetica, sans-serif' },
    margin: { t: 50, r: 30, b: 30, l: 30 },
    showlegend: files.length > 1,
  };

  return renderToImage(traces, layout, opts);
}
