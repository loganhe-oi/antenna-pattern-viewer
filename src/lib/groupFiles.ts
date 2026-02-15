import type { MsiFile } from '../types/msi';
import { parseNameSegments } from './nameSegments';
import type { NameSegments } from './nameSegments';

export type GroupByKey = 'none' | 'tilt' | 'polarization' | 'port';

export interface FileGroup {
  key: string;
  label: string;
  files: MsiFile[];
}

const SEGMENT_FIELD: Record<Exclude<GroupByKey, 'none'>, keyof NameSegments> = {
  tilt: 'tilt',
  polarization: 'polarization',
  port: 'port',
};

export function groupFiles(files: MsiFile[], groupBy: GroupByKey): FileGroup[] {
  if (groupBy === 'none') {
    return [{ key: '__all__', label: 'All Antennas', files }];
  }

  const field = SEGMENT_FIELD[groupBy];
  const groups = new Map<string, MsiFile[]>();
  const ungrouped: MsiFile[] = [];

  for (const file of files) {
    const seg = parseNameSegments(file.metadata.name || file.fileName);
    const val = seg[field];
    if (val) {
      if (!groups.has(val)) groups.set(val, []);
      groups.get(val)!.push(file);
    } else {
      ungrouped.push(file);
    }
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const numA = parseInt(a);
    const numB = parseInt(b);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.localeCompare(b);
  });

  const result: FileGroup[] = sortedKeys.map(key => {
    const gf = groups.get(key)!;
    return {
      key,
      label: `${key} (${gf.length} antenna${gf.length !== 1 ? 's' : ''})`,
      files: gf,
    };
  });

  if (ungrouped.length > 0) {
    result.push({
      key: '__ungrouped__',
      label: `Ungrouped (${ungrouped.length})`,
      files: ungrouped,
    });
  }

  return result;
}
