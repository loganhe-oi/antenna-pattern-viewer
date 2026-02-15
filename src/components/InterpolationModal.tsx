import { useState } from 'react';
import type { MsiFile } from '../types/msi';
import type { InterpolationParam } from '../lib/interpolatePattern';
import './InterpolationModal.css';

interface InterpolationModalProps {
  files: MsiFile[];
  onGenerate: (fileAId: string, fileBId: string, param: InterpolationParam, target: number) => void;
  onClose: () => void;
}

export default function InterpolationModal({ files, onGenerate, onClose }: InterpolationModalProps) {
  const [fileAId, setFileAId] = useState(files[0]?.id ?? '');
  const [fileBId, setFileBId] = useState(files[1]?.id ?? '');
  const [param, setParam] = useState<InterpolationParam>('tilt');
  const [target, setTarget] = useState('');

  const fileA = files.find(f => f.id === fileAId);
  const fileB = files.find(f => f.id === fileBId);

  function getParamValue(file: MsiFile | undefined): string {
    if (!file) return '?';
    if (param === 'tilt') return file.metadata.electricalTilt || '?';
    return file.metadata.frequency || '?';
  }

  const canGenerate = fileAId && fileBId && fileAId !== fileBId && target !== '' && !isNaN(Number(target));

  function handleGenerate() {
    if (!canGenerate) return;
    onGenerate(fileAId, fileBId, param, Number(target));
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Pattern Interpolation</h2>

        <div className="modal-field">
          <label>File A</label>
          <select value={fileAId} onChange={e => setFileAId(e.target.value)}>
            {files.map(f => (
              <option key={f.id} value={f.id}>{f.metadata.name || f.fileName}</option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label>File B</label>
          <select value={fileBId} onChange={e => setFileBId(e.target.value)}>
            {files.map(f => (
              <option key={f.id} value={f.id}>{f.metadata.name || f.fileName}</option>
            ))}
          </select>
        </div>

        <div className="modal-field">
          <label>Parameter</label>
          <select value={param} onChange={e => setParam(e.target.value as InterpolationParam)}>
            <option value="tilt">Electrical Tilt</option>
            <option value="frequency">Frequency</option>
          </select>
        </div>

        <div className="modal-field">
          <label>Target Value</label>
          <input
            type="number"
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder={`Between ${getParamValue(fileA)} and ${getParamValue(fileB)}`}
            step="any"
          />
          <div className="hint">
            A: {getParamValue(fileA)} &mdash; B: {getParamValue(fileB)}
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-btn-secondary" onClick={onClose}>Cancel</button>
          <button className="modal-btn-primary" onClick={handleGenerate} disabled={!canGenerate}>
            Generate
          </button>
        </div>
      </div>
    </div>
  );
}
