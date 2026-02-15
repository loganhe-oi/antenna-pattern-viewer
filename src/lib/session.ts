import type { MsiFile } from '../types/msi';

export interface SessionData {
  version: 1;
  timestamp: string;
  appState: {
    files: MsiFile[];
    selectedFileId: string | null;
  };
  filterState?: {
    search: string;
    polarizations: string[];
    tilts: string[];
    ports: string[];
  };
}

export function serializeSession(
  files: MsiFile[],
  selectedFileId: string | null,
  filterState?: { search: string; polarizations: Set<string>; tilts: Set<string>; ports: Set<string> },
): string {
  const session: SessionData = {
    version: 1,
    timestamp: new Date().toISOString(),
    appState: { files, selectedFileId },
  };

  if (filterState) {
    session.filterState = {
      search: filterState.search,
      polarizations: Array.from(filterState.polarizations),
      tilts: Array.from(filterState.tilts),
      ports: Array.from(filterState.ports),
    };
  }

  return JSON.stringify(session, null, 2);
}

export function deserializeSession(json: string): SessionData {
  const data = JSON.parse(json);
  if (data.version !== 1) throw new Error('Unsupported session version');
  return data as SessionData;
}

export function downloadSession(
  files: MsiFile[],
  selectedFileId: string | null,
  filterState?: { search: string; polarizations: Set<string>; tilts: Set<string>; ports: Set<string> },
) {
  const json = serializeSession(files, selectedFileId, filterState);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `antenna-session-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function loadSessionFile(): Promise<SessionData> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = deserializeSession(reader.result as string);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    };
    input.click();
  });
}
