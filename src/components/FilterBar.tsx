import { useMemo } from 'react';
import type { MsiFile } from '../types/msi';
import { parseNameSegments } from '../lib/nameSegments';
import './FilterBar.css';

export interface FilterState {
  search: string;
  polarizations: Set<string>;
  tilts: Set<string>;
  ports: Set<string>;
}

export function createEmptyFilter(): FilterState {
  return { search: '', polarizations: new Set(), tilts: new Set(), ports: new Set() };
}

export function isFilterActive(f: FilterState): boolean {
  return f.search !== '' || f.polarizations.size > 0 || f.tilts.size > 0 || f.ports.size > 0;
}

export function applyFilter(files: MsiFile[], filter: FilterState): MsiFile[] {
  return files.filter(file => {
    // Text search
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const searchable = [
        file.metadata.name,
        file.metadata.make,
        file.metadata.frequency,
        file.metadata.tilt,
        file.metadata.electricalTilt,
        file.metadata.gain,
        file.fileName,
      ].join(' ').toLowerCase();
      if (!searchable.includes(q)) return false;
    }

    // Chip filters
    const seg = parseNameSegments(file.metadata.name || file.fileName);

    if (filter.polarizations.size > 0) {
      if (!seg.polarization || !filter.polarizations.has(seg.polarization)) return false;
    }
    if (filter.tilts.size > 0) {
      if (!seg.tilt || !filter.tilts.has(seg.tilt)) return false;
    }
    if (filter.ports.size > 0) {
      if (!seg.port || !filter.ports.has(seg.port)) return false;
    }

    return true;
  });
}

interface FilterBarProps {
  files: MsiFile[];
  filter: FilterState;
  filteredCount: number;
  onFilterChange: (filter: FilterState) => void;
}

export default function FilterBar({ files, filter, filteredCount, onFilterChange }: FilterBarProps) {
  // Extract unique chip values from all loaded files
  const chips = useMemo(() => {
    const pols = new Set<string>();
    const tilts = new Set<string>();
    const ports = new Set<string>();

    for (const file of files) {
      const seg = parseNameSegments(file.metadata.name || file.fileName);
      if (seg.polarization) pols.add(seg.polarization);
      if (seg.tilt) tilts.add(seg.tilt);
      if (seg.port) ports.add(seg.port);
    }

    return {
      polarizations: [...pols].sort(),
      tilts: [...tilts].sort((a, b) => parseInt(a) - parseInt(b)),
      ports: [...ports].sort(),
    };
  }, [files]);

  const hasChips = chips.polarizations.length > 0 || chips.tilts.length > 0 || chips.ports.length > 0;
  const active = isFilterActive(filter);

  function toggleChip(group: 'polarizations' | 'tilts' | 'ports', value: string) {
    const next = new Set(filter[group]);
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    onFilterChange({ ...filter, [group]: next });
  }

  function clearAll() {
    onFilterChange(createEmptyFilter());
  }

  if (files.length === 0) return null;

  return (
    <div className="filter-bar">
      <div className="filter-search">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Filter antennas..."
          value={filter.search}
          onChange={e => onFilterChange({ ...filter, search: e.target.value })}
        />
        {filter.search && (
          <button
            className="search-clear"
            onClick={() => onFilterChange({ ...filter, search: '' })}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {hasChips && (
        <div className="filter-chips">
          {chips.polarizations.length > 0 && (
            <div className="chip-group">
              <span className="chip-label">Pol</span>
              {chips.polarizations.map(v => (
                <button
                  key={v}
                  className={`chip chip-pol ${filter.polarizations.has(v) ? 'active' : ''}`}
                  onClick={() => toggleChip('polarizations', v)}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {chips.tilts.length > 0 && (
            <div className="chip-group">
              <span className="chip-label">Tilt</span>
              {chips.tilts.map(v => (
                <button
                  key={v}
                  className={`chip chip-tilt ${filter.tilts.has(v) ? 'active' : ''}`}
                  onClick={() => toggleChip('tilts', v)}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {chips.ports.length > 0 && (
            <div className="chip-group">
              <span className="chip-label">Port</span>
              {chips.ports.map(v => (
                <button
                  key={v}
                  className={`chip chip-port ${filter.ports.has(v) ? 'active' : ''}`}
                  onClick={() => toggleChip('ports', v)}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="filter-status">
        <span className="filter-count">
          {active
            ? `Showing ${filteredCount} of ${files.length}`
            : `${files.length} antennas`}
        </span>
        {active && (
          <button className="clear-filters-btn" onClick={clearAll}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
