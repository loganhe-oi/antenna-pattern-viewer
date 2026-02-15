import type { MsiFile, PatternAdjustments } from '../types/msi';
import './AdjustmentPanel.css';

interface AdjustmentPanelProps {
  file: MsiFile | null;
  onSetAdjustments: (id: string, adj: PatternAdjustments) => void;
  onResetAdjustments: (id: string) => void;
  onEnsureVisible?: (id: string) => void;
}

const DEFAULT_ADJ: PatternAdjustments = {
  mechanicalDowntilt: 0,
  electricalTiltDelta: 0,
  azimuthRotation: 0,
};

export default function AdjustmentPanel({
  file,
  onSetAdjustments,
  onResetAdjustments,
  onEnsureVisible,
}: AdjustmentPanelProps) {
  if (!file) {
    return (
      <div className="adjustment-panel">
        <h3>Adjustments</h3>
        <p className="adjustment-no-selection">Select a file to adjust</p>
      </div>
    );
  }

  const adj = file.adjustments ?? DEFAULT_ADJ;
  const hasChanges = adj.mechanicalDowntilt !== 0 ||
                     adj.electricalTiltDelta !== 0 ||
                     adj.azimuthRotation !== 0;

  function update(field: keyof PatternAdjustments, value: number) {
    onSetAdjustments(file!.id, { ...adj, [field]: value });
    // Ensure the file is visible in the plot when adjusting it
    if (!file!.visible && onEnsureVisible) {
      onEnsureVisible(file!.id);
    }
  }

  return (
    <div className="adjustment-panel">
      <h3>
        Adjustments
        {hasChanges && (
          <button className="adjustment-reset-btn" onClick={() => onResetAdjustments(file.id)}>
            Reset
          </button>
        )}
      </h3>

      <div className="adjustment-slider">
        <div className="adjustment-slider-header">
          <span className="adjustment-slider-label">Mech. Downtilt</span>
          <span className="adjustment-slider-value">{adj.mechanicalDowntilt.toFixed(1)}&deg;</span>
        </div>
        <input
          type="range"
          min={0}
          max={15}
          step={0.5}
          value={adj.mechanicalDowntilt}
          onChange={e => update('mechanicalDowntilt', Number(e.target.value))}
        />
      </div>

      <div className="adjustment-slider">
        <div className="adjustment-slider-header">
          <span className="adjustment-slider-label">Elec. Tilt Delta</span>
          <span className="adjustment-slider-value">{adj.electricalTiltDelta > 0 ? '+' : ''}{adj.electricalTiltDelta.toFixed(1)}&deg;</span>
        </div>
        <input
          type="range"
          min={-10}
          max={10}
          step={0.5}
          value={adj.electricalTiltDelta}
          onChange={e => update('electricalTiltDelta', Number(e.target.value))}
        />
      </div>

      <div className="adjustment-slider">
        <div className="adjustment-slider-header">
          <span className="adjustment-slider-label">Azimuth Rotation</span>
          <span className="adjustment-slider-value">{((adj.azimuthRotation % 360) + 360) % 360}&deg;</span>
        </div>
        <input
          type="range"
          min={0}
          max={359}
          step={1}
          value={((adj.azimuthRotation % 360) + 360) % 360}
          onChange={e => update('azimuthRotation', ((Number(e.target.value) % 360) + 360) % 360)}
        />
      </div>
    </div>
  );
}
