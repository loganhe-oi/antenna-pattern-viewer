import { useMemo, useRef, useState } from 'react';
import { useAntennaStore } from './hooks/useAntennaStore';
import { useAdjustedFiles } from './hooks/useAdjustedFiles';
import { parseMsiFile } from './lib/msiParser';
import { computeBeamwidths } from './lib/beamwidth';
import type { ComputedFileData } from './lib/beamwidth';
import { analyzeSidelobes } from './lib/sidelobeAnalysis';
import { computeEnvelope } from './lib/envelope';
import { interpolatePatterns, type InterpolationParam } from './lib/interpolatePattern';
import { downloadSession, loadSessionFile } from './lib/session';
import {
  exportParametersCsv,
  exportPatternDataCsv,
  downloadDataUrl,
  exportReportPdf,
  exportMsiFile,
  exportAtollTxt,
} from './lib/exportUtils';
import Header from './components/Header';
import FileDropZone from './components/FileDropZone';
import FilterBar, { type FilterState, createEmptyFilter, applyFilter } from './components/FilterBar';
import FileList from './components/FileList';
import MetadataPanel from './components/MetadataPanel';
import CoveragePanel from './components/CoveragePanel';
import { type CoverageParams, DEFAULT_COVERAGE_PARAMS } from './types/coverage';
import { useCoverageResults } from './hooks/useCoverageResults';
import AdjustmentPanel from './components/AdjustmentPanel';
import PatternView from './components/PatternView';
import type { PatternViewHandle } from './components/PatternView';
import ComparisonTable from './components/ComparisonTable';
import InterpolationModal from './components/InterpolationModal';
import './App.css';

export default function App() {
  const store = useAntennaStore();
  const [filter, setFilter] = useState<FilterState>(createEmptyFilter);
  const patternViewRef = useRef<PatternViewHandle>(null);
  const [showInterpolation, setShowInterpolation] = useState(false);
  const [coverageParams, setCoverageParams] = useState<CoverageParams>(DEFAULT_COVERAGE_PARAMS);

  function addParsedFiles(content: string, fileName: string) {
    const result = parseMsiFile(content, fileName, store.nextColor);
    const files = Array.isArray(result) ? result : [result];
    for (const file of files) {
      store.addFile(file);
    }
  }

  function handleFileParsed(content: string, fileName: string) {
    addParsedFiles(content, fileName);
  }

  const filteredFiles = useMemo(
    () => applyFilter(store.state.files, filter),
    [store.state.files, filter],
  );

  // Apply adjustments before downstream usage
  // Pass all files so electrical tilt can interpolate between family members
  const adjustedFiltered = useAdjustedFiles(filteredFiles, store.state.files);
  const visibleFiles = adjustedFiltered.filter(f => f.visible);

  const comparisonData: ComputedFileData[] = useMemo(
    () => visibleFiles.map(f => ({
      hBeamwidths: computeBeamwidths(f.horizontal),
      vBeamwidths: computeBeamwidths(f.vertical),
      hSidelobes: analyzeSidelobes(f.horizontal),
      vSidelobes: analyzeSidelobes(f.vertical),
    })),
    [visibleFiles],
  );

  // --- Export handlers ---
  function handleExportParametersCsv() {
    exportParametersCsv(visibleFiles, comparisonData);
  }

  function handleExportPatternDataCsv() {
    exportPatternDataCsv(visibleFiles);
  }

  async function handleExportPlotsPng() {
    if (!patternViewRef.current) return;
    const images = await patternViewRef.current.exportImages();
    downloadDataUrl(images.horizontal, 'horizontal_pattern.png');
    await new Promise(r => setTimeout(r, 200));
    downloadDataUrl(images.vertical, 'vertical_pattern.png');
  }

  async function handleExportReportPdf() {
    if (!patternViewRef.current) return;
    const images = await patternViewRef.current.exportImages();
    await exportReportPdf(visibleFiles, comparisonData, images);
  }

  function handleExportMsi() {
    const file = selectedFile ?? visibleFiles[0];
    if (file) exportMsiFile(file);
  }

  function handleExportAtollTxt() {
    const file = selectedFile ?? visibleFiles[0];
    if (file) exportAtollTxt(file);
  }

  // --- Feature handlers ---
  function handleComputeEnvelope() {
    if (visibleFiles.length < 2) return;
    const envelope = computeEnvelope(visibleFiles, store.nextColor);
    store.addFile(envelope);
  }

  function handleInterpolate(fileAId: string, fileBId: string, param: InterpolationParam, target: number) {
    const fileA = visibleFiles.find(f => f.id === fileAId);
    const fileB = visibleFiles.find(f => f.id === fileBId);
    if (!fileA || !fileB) return;
    const result = interpolatePatterns(fileA, fileB, param, target, store.nextColor);
    if (result) store.addFile(result);
  }

  function handleSaveSession() {
    downloadSession(store.state.files, store.state.selectedFileId, filter);
  }

  async function handleLoadSession() {
    try {
      const session = await loadSessionFile();
      store.loadSession(session.appState.files, session.appState.selectedFileId);
      if (session.filterState) {
        setFilter({
          search: session.filterState.search,
          polarizations: new Set(session.filterState.polarizations),
          tilts: new Set(session.filterState.tilts),
          ports: new Set(session.filterState.ports),
        });
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }

  // Find selected file from adjusted list for panels
  const selectedFile = adjustedFiltered.find(f => f.id === store.state.selectedFileId) ?? null;
  const coverageResults = useCoverageResults(selectedFile, coverageParams);

  return (
    <div className="app">
      <Header
        hasVisibleFiles={visibleFiles.length > 0}
        visibleFileCount={visibleFiles.length}
        onExportParametersCsv={handleExportParametersCsv}
        onExportPatternDataCsv={handleExportPatternDataCsv}
        onExportPlotsPng={handleExportPlotsPng}
        onExportReportPdf={handleExportReportPdf}
        onExportMsi={handleExportMsi}
        onExportAtollTxt={handleExportAtollTxt}
        onComputeEnvelope={handleComputeEnvelope}
        onInterpolate={() => setShowInterpolation(true)}
        onSaveSession={handleSaveSession}
        onLoadSession={handleLoadSession}
      />
      <div className="app-layout">
        <aside className="sidebar">
          <FileDropZone onFileParsed={handleFileParsed} />
          <FilterBar
            files={store.state.files}
            filter={filter}
            filteredCount={filteredFiles.length}
            onFilterChange={setFilter}
          />
          <FileList
            files={adjustedFiltered}
            selectedId={store.state.selectedFileId}
            onSelect={store.selectFile}
            onToggle={store.toggleVisibility}
            onRemove={store.removeFile}
            onClearAll={store.clearAll}
            onSetVisibilityBatch={store.setVisibilityBatch}
            onSetColor={store.setColor}
          />
          <AdjustmentPanel
            file={selectedFile}
            onSetAdjustments={store.setAdjustments}
            onResetAdjustments={store.resetAdjustments}
            onEnsureVisible={(id) => {
              const f = store.state.files.find(f => f.id === id);
              if (f && !f.visible) store.toggleVisibility(id);
            }}
          />
          <MetadataPanel file={selectedFile} />
          <CoveragePanel file={selectedFile} params={coverageParams} onParamsChange={setCoverageParams} results={coverageResults} />
        </aside>
        <main className="main-content">
          <PatternView ref={patternViewRef} files={visibleFiles} selectedFile={selectedFile} coverageResults={coverageResults} coverageParams={coverageParams} />
          {visibleFiles.length > 1 && (
            <ComparisonTable files={visibleFiles} comparisonData={comparisonData} />
          )}
          <footer className="app-footer">Designed by ORAN Infra Inc. Open source to every engineer</footer>
        </main>
      </div>

      {showInterpolation && (
        <InterpolationModal
          files={visibleFiles}
          onGenerate={handleInterpolate}
          onClose={() => setShowInterpolation(false)}
        />
      )}
    </div>
  );
}
