import { useMemo, useState } from 'react';
import type { MsiFile } from '../types/msi';
import { groupFiles } from '../lib/groupFiles';
import type { GroupByKey, FileGroup } from '../lib/groupFiles';
import ColorPicker from './ColorPicker';
import './FileList.css';

interface FileListProps {
  files: MsiFile[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
  onSetVisibilityBatch: (ids: string[], visible: boolean) => void;
  onSetColor?: (id: string, color: string) => void;
}

export default function FileList({
  files,
  selectedId,
  onSelect,
  onToggle,
  onRemove,
  onClearAll,
  onSetVisibilityBatch,
  onSetColor,
}: FileListProps) {
  const [groupBy, setGroupBy] = useState<GroupByKey>('tilt');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const groups = useMemo(() => groupFiles(files, groupBy), [files, groupBy]);

  function toggleCollapsed(key: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleGroupToggle(group: FileGroup) {
    const allVisible = group.files.every(f => f.visible);
    onSetVisibilityBatch(group.files.map(f => f.id), !allVisible);
  }

  if (files.length === 0) return null;

  return (
    <div className="file-list">
      <div className="file-list-header">
        <h3>Loaded Files</h3>
        <div className="file-list-actions">
          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as GroupByKey)}
          >
            <option value="none">No Grouping</option>
            <option value="tilt">Tilt Position</option>
            <option value="polarization">Polarization</option>
            <option value="port">Port</option>
          </select>
          {files.length > 1 && (
            <button className="clear-btn" onClick={onClearAll}>
              Clear All
            </button>
          )}
        </div>
      </div>

      {groups.map(group => {
        const isCollapsed = collapsedGroups.has(group.key);
        const showHeader = groupBy !== 'none';
        const allVisible = group.files.every(f => f.visible);

        return (
          <div key={group.key} className="file-group">
            {showHeader && (
              <div
                className="group-header"
                onClick={() => toggleCollapsed(group.key)}
              >
                <svg
                  className={`collapse-icon ${isCollapsed ? 'collapsed' : ''}`}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                <span className="group-label">{group.label}</span>
                <button
                  className="group-toggle-btn"
                  onClick={e => {
                    e.stopPropagation();
                    handleGroupToggle(group);
                  }}
                >
                  {allVisible ? 'Hide All' : 'Show All'}
                </button>
              </div>
            )}
            {!isCollapsed && (
              <ul>
                {group.files.map(file => (
                  <li
                    key={file.id}
                    className={`file-item ${file.id === selectedId ? 'selected' : ''}`}
                    onClick={() => onSelect(file.id)}
                  >
                    {onSetColor ? (
                      <ColorPicker
                        color={file.color}
                        onChange={c => onSetColor(file.id, c)}
                      />
                    ) : (
                      <span
                        className="color-dot"
                        style={{ backgroundColor: file.color }}
                      />
                    )}
                    <span className="file-name" title={file.fileName}>
                      {file.metadata.name || file.fileName}
                    </span>
                    {file.synthetic && <span className="synthetic-badge">SYN</span>}
                    <button
                      className="icon-btn"
                      title={file.visible ? 'Hide' : 'Show'}
                      onClick={e => {
                        e.stopPropagation();
                        onToggle(file.id);
                      }}
                    >
                      {file.visible ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="icon-btn remove-btn"
                      title="Remove"
                      onClick={e => {
                        e.stopPropagation();
                        onRemove(file.id);
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
