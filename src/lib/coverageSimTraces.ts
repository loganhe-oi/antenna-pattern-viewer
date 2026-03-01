import type { CoverageResults } from '../hooks/useCoverageResults';

const DEG2RAD = Math.PI / 180;

/**
 * Log-compressed horizontal distance scaling.
 * scaledR = H * (1 + log10(1 + R / H))
 * Keeps tower visible while showing full coverage range.
 */
export function createScaleFn(antennaHeight: number): (realMeters: number) => number {
  const H = Math.max(antennaHeight, 1);
  return (R: number) => H * (1 + Math.log10(1 + R / H));
}

/**
 * Tower: vertical line from ground to antenna height with diamond marker at top.
 */
export function buildTowerTrace(height: number) {
  return {
    type: 'scatter3d' as const,
    mode: 'lines+markers' as const,
    x: [0, 0],
    y: [0, 0],
    z: [0, height],
    line: { color: '#ffffff', width: 4 },
    marker: {
      size: [0, 8],
      symbol: ['circle', 'diamond'],
      color: ['#ffffff', '#ff4444'],
    },
    name: 'Tower',
    showlegend: true,
  };
}

/**
 * Beam cone wireframe: inner/outer arcs on ground + rays from antenna tip.
 */
export function buildBeamConeTraces(
  results: CoverageResults,
  antennaHeight: number,
  scale: (m: number) => number,
) {
  const { beam } = results;
  if (!beam) return [];

  const halfH = beam.hBeamwidthUsed / 2;
  const nAz = 24;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const traces: any[] = [];

  const azAngles: number[] = [];
  for (let i = 0; i <= nAz; i++) {
    azAngles.push(-halfH + (beam.hBeamwidthUsed * i) / nAz);
  }

  // Inner arc on ground
  const innerX: number[] = [];
  const innerY: number[] = [];
  const innerZ: number[] = [];
  for (const az of azAngles) {
    const r = scale(beam.innerEdge);
    innerX.push(r * Math.sin(az * DEG2RAD));
    innerY.push(r * Math.cos(az * DEG2RAD));
    innerZ.push(0);
  }
  traces.push({
    type: 'scatter3d' as const,
    mode: 'lines' as const,
    x: innerX, y: innerY, z: innerZ,
    line: { color: 'rgba(255, 165, 0, 0.7)', width: 2 },
    name: 'Beam (inner)',
    showlegend: false,
    hoverinfo: 'skip' as const,
  });

  // Outer arc on ground
  const outerX: number[] = [];
  const outerY: number[] = [];
  const outerZ: number[] = [];
  for (const az of azAngles) {
    const r = scale(beam.outerEdge);
    outerX.push(r * Math.sin(az * DEG2RAD));
    outerY.push(r * Math.cos(az * DEG2RAD));
    outerZ.push(0);
  }
  traces.push({
    type: 'scatter3d' as const,
    mode: 'lines' as const,
    x: outerX, y: outerY, z: outerZ,
    line: { color: 'rgba(255, 165, 0, 0.7)', width: 2 },
    name: 'Beam (outer)',
    showlegend: false,
    hoverinfo: 'skip' as const,
  });

  // Rays from antenna tip to arc edges + center ray
  const rayX: (number | null)[] = [];
  const rayY: (number | null)[] = [];
  const rayZ: (number | null)[] = [];

  // Side rays to outer arc corners
  for (const az of [azAngles[0], azAngles[azAngles.length - 1]]) {
    const rOuter = scale(beam.outerEdge);
    rayX.push(0, rOuter * Math.sin(az * DEG2RAD), null);
    rayY.push(0, rOuter * Math.cos(az * DEG2RAD), null);
    rayZ.push(antennaHeight, 0, null);
    const rInner = scale(beam.innerEdge);
    rayX.push(0, rInner * Math.sin(az * DEG2RAD), null);
    rayY.push(0, rInner * Math.cos(az * DEG2RAD), null);
    rayZ.push(antennaHeight, 0, null);
  }
  // Center beam ray
  const rCenter = scale(beam.centerDistance);
  rayX.push(0, 0, null);
  rayY.push(0, rCenter, null);
  rayZ.push(antennaHeight, 0, null);

  traces.push({
    type: 'scatter3d' as const,
    mode: 'lines' as const,
    x: rayX, y: rayY, z: rayZ,
    line: { color: 'rgba(255, 165, 0, 0.5)', width: 1.5 },
    name: 'Beam',
    showlegend: true,
    hoverinfo: 'skip' as const,
  });

  return traces;
}

/**
 * Ground coverage footprint as mesh3d sector annulus with signal-strength coloring.
 */
export function buildGroundFootprintTrace(
  results: CoverageResults,
  scale: (m: number) => number,
) {
  const { area } = results;
  if (!area || area.outerRadius <= 0) return null;

  const halfAngle = area.sectorAngle / 2;
  const nRadial = 5;
  const nAz = 24;
  const innerR = area.innerRadius * 1000; // km → m
  const outerR = area.outerRadius * 1000;

  const vx: number[] = [];
  const vy: number[] = [];
  const vz: number[] = [];
  const fi: number[] = [];
  const fj: number[] = [];
  const fk: number[] = [];
  const faceColors: string[] = [];

  // Vertex grid: (nRadial+1) rings × (nAz+1) azimuth steps
  for (let ri = 0; ri <= nRadial; ri++) {
    const t = ri / nRadial;
    const realR = innerR + t * (outerR - innerR);
    const scaledR = scale(realR);
    for (let ai = 0; ai <= nAz; ai++) {
      const azDeg = -halfAngle + (area.sectorAngle * ai) / nAz;
      const azRad = azDeg * DEG2RAD;
      vx.push(scaledR * Math.sin(azRad));
      vy.push(scaledR * Math.cos(azRad));
      vz.push(0);
    }
  }

  // Triangulate the grid
  const cols = nAz + 1;
  for (let ri = 0; ri < nRadial; ri++) {
    const t = ri / nRadial;
    const strength = 1 - t * 0.7;
    const r = Math.round(66 + 189 * strength);
    const g = Math.round(133 + 50 * strength);
    const b = Math.round(244 * strength);
    const color = `rgb(${r}, ${g}, ${b})`;
    for (let ai = 0; ai < nAz; ai++) {
      const idx = ri * cols + ai;
      const nextRow = (ri + 1) * cols + ai;
      fi.push(idx, idx + 1);
      fj.push(nextRow, nextRow);
      fk.push(idx + 1, nextRow + 1);
      faceColors.push(color, color);
    }
  }

  return {
    type: 'mesh3d' as const,
    x: vx, y: vy, z: vz,
    i: fi, j: fj, k: fk,
    facecolor: faceColors,
    opacity: 0.6,
    name: 'Coverage',
    showlegend: true,
    flatshading: true,
  };
}

/**
 * Ground reference grid: concentric distance rings + radial lines.
 */
export function buildGroundGridTrace(
  outerRadiusM: number,
  scale: (m: number) => number,
) {
  const niceDistances = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const rings = niceDistances.filter(d => d <= outerRadiusM * 1.2 && d >= 20);

  const x: (number | null)[] = [];
  const y: (number | null)[] = [];
  const z: (number | null)[] = [];

  const nSteps = 60;
  for (const d of rings) {
    const r = scale(d);
    for (let i = 0; i <= nSteps; i++) {
      const angle = (2 * Math.PI * i) / nSteps;
      x.push(r * Math.sin(angle));
      y.push(r * Math.cos(angle));
      z.push(0);
    }
    x.push(null);
    y.push(null);
    z.push(null);
  }

  // Radial lines at 0°, 90°, 180°, 270°
  const maxR = scale(outerRadiusM * 1.2);
  for (const angle of [0, 90, 180, 270]) {
    const rad = angle * DEG2RAD;
    x.push(0, maxR * Math.sin(rad), null);
    y.push(0, maxR * Math.cos(rad), null);
    z.push(0, 0, null);
  }

  return {
    type: 'scatter3d' as const,
    mode: 'lines' as const,
    x, y, z,
    line: { color: 'rgba(255,255,255,0.08)', width: 1 },
    name: 'Grid',
    showlegend: false,
    hoverinfo: 'skip' as const,
  };
}

/**
 * Distance text labels placed along +X axis on the ground.
 */
export function buildDistanceLabels(
  outerRadiusM: number,
  scale: (m: number) => number,
) {
  const niceDistances = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  const rings = niceDistances.filter(d => d <= outerRadiusM * 1.2 && d >= 20);

  const x: number[] = [];
  const y: number[] = [];
  const z: number[] = [];
  const text: string[] = [];

  for (const d of rings) {
    const r = scale(d);
    x.push(r);
    y.push(0);
    z.push(0);
    text.push(d >= 1000 ? `${d / 1000} km` : `${d} m`);
  }

  return {
    type: 'scatter3d' as const,
    mode: 'text' as const,
    x, y, z, text,
    textfont: { size: 9, color: 'rgba(255,255,255,0.4)' },
    name: 'Labels',
    showlegend: false,
    hoverinfo: 'skip' as const,
  };
}
