import { useEffect, useRef, useState } from 'react';
import './Header.css';

interface HeaderProps {
  hasVisibleFiles: boolean;
  visibleFileCount: number;
  onExportParametersCsv: () => void;
  onExportPatternDataCsv: () => void;
  onExportPlotsPng: () => void;
  onExportReportPdf: () => void;
  onExportMsi: () => void;
  onExportAtollTxt: () => void;
  onComputeEnvelope?: () => void;
  onInterpolate?: () => void;
  onSaveSession?: () => void;
  onLoadSession?: () => void;
}

export default function Header({
  hasVisibleFiles,
  visibleFileCount,
  onExportParametersCsv,
  onExportPatternDataCsv,
  onExportPlotsPng,
  onExportReportPdf,
  onExportMsi,
  onExportAtollTxt,
  onComputeEnvelope,
  onInterpolate,
  onSaveSession,
  onLoadSession,
}: HeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  function handleAction(fn: () => void) {
    fn();
    setDropdownOpen(false);
  }

  return (
    <header className="app-header">
      <div className="header-brand">
        <span className="header-logo">Oi</span>
        <h1>Antenna Pattern Viewer</h1>
      </div>
      <div className="header-actions">
        {visibleFileCount >= 2 && onComputeEnvelope && (
          <button className="header-action-btn" onClick={onComputeEnvelope} title="Compute envelope (max gain) across visible antennas">
            Envelope
          </button>
        )}
        {visibleFileCount >= 2 && onInterpolate && (
          <button className="header-action-btn" onClick={onInterpolate} title="Interpolate between two patterns">
            Interpolate
          </button>
        )}
        {hasVisibleFiles && (
          <div className="export-dropdown" ref={dropdownRef}>
            <button
              className="export-btn"
              onClick={() => setDropdownOpen(o => !o)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Export
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {dropdownOpen && (
              <div className="export-menu">
                <button onClick={() => handleAction(onExportParametersCsv)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Parameters CSV
                </button>
                <button onClick={() => handleAction(onExportPatternDataCsv)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Pattern Data CSV
                </button>
                <button onClick={() => handleAction(onExportPlotsPng)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Plots as PNG
                </button>
                <div className="export-menu-divider" />
                <button onClick={() => handleAction(onExportReportPdf)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                  Report PDF
                </button>
                <div className="export-menu-divider" />
                <button onClick={() => handleAction(onExportMsi)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Selected as .msi
                </button>
                <button onClick={() => handleAction(onExportAtollTxt)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Selected as Atoll .txt
                </button>
                {(onSaveSession || onLoadSession) && <div className="export-menu-divider" />}
                {onSaveSession && (
                  <button onClick={() => handleAction(onSaveSession)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Save Session
                  </button>
                )}
                {onLoadSession && (
                  <button onClick={() => handleAction(onLoadSession)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    Load Session
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        <span className="header-subtitle">MSI / XML / JSON / Planet / NSMA / EDX</span>
      </div>
    </header>
  );
}
