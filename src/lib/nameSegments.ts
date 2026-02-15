/** Parsed segments from antenna name like JZ003_-45_617_02DT_Lr1 */
export interface NameSegments {
  model: string | null;        // "JZ003"
  polarization: string | null; // "-45", "+45"
  frequency: string | null;    // "617", "3500"
  tilt: string | null;         // "02DT", "03DT"
  port: string | null;         // "Lr1", "Rr2", "CLy2", "p1"
}

export function parseNameSegments(name: string): NameSegments {
  const parts = name.split('_');
  let model: string | null = null;
  let polarization: string | null = null;
  let frequency: string | null = null;
  let tilt: string | null = null;
  let port: string | null = null;

  if (parts.length > 0 && !/^[+-]\d+$/.test(parts[0])) {
    model = parts[0];
  }

  for (const p of parts) {
    if (/^[+-]\d+$/.test(p)) polarization = p;
    else if (/^\d+DT$/i.test(p)) tilt = p;
    else if (/^(C?[LR][a-z]|p)\d+$/i.test(p)) port = p;
    else if (/^\d{3,4}$/.test(p)) frequency = p;
  }

  return { model, polarization, frequency, tilt, port };
}
