export interface MsiMetadata {
  name: string;
  make: string;
  frequency: string;
  gain: string;
  hWidth: string;
  vWidth: string;
  frontToBack: string;
  tilt: string;
  electricalTilt: string;
  polarization: string;
  comment: string;
  extra: Record<string, string>;
}

export interface PatternPoint {
  angleDeg: number;
  lossdB: number;
}

export interface PatternAdjustments {
  mechanicalDowntilt: number;
  electricalTiltDelta: number;
  azimuthRotation: number;
}

export interface MsiFile {
  id: string;
  fileName: string;
  metadata: MsiMetadata;
  horizontal: PatternPoint[];
  vertical: PatternPoint[];
  color: string;
  visible: boolean;
  synthetic?: boolean;
  sourceFileIds?: string[];
  adjustments?: PatternAdjustments;
}

export interface AppState {
  files: MsiFile[];
  selectedFileId: string | null;
}

export type AppAction =
  | { type: 'ADD_FILE'; payload: MsiFile }
  | { type: 'REMOVE_FILE'; payload: string }
  | { type: 'TOGGLE_VISIBILITY'; payload: string }
  | { type: 'SET_VISIBILITY_BATCH'; payload: { ids: string[]; visible: boolean } }
  | { type: 'SELECT_FILE'; payload: string }
  | { type: 'CLEAR_ALL' }
  | { type: 'SET_COLOR'; payload: { id: string; color: string } }
  | { type: 'SET_ADJUSTMENTS'; payload: { id: string; adjustments: PatternAdjustments } }
  | { type: 'RESET_ADJUSTMENTS'; payload: string }
  | { type: 'LOAD_SESSION'; payload: { files: MsiFile[]; selectedFileId: string | null } };
