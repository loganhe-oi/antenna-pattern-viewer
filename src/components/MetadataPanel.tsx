import type { MsiFile } from '../types/msi';
import './MetadataPanel.css';

interface MetadataPanelProps {
  file: MsiFile | null;
}

export default function MetadataPanel({ file }: MetadataPanelProps) {
  if (!file) {
    return (
      <div className="metadata-panel empty">
        <p>Select a file to view metadata</p>
      </div>
    );
  }

  const fields: [string, string][] = [
    ['Name', file.metadata.name],
    ['Manufacturer', file.metadata.make],
    ['Frequency', file.metadata.frequency ? `${file.metadata.frequency} MHz` : ''],
    ['Gain', file.metadata.gain],
    ['H Beamwidth', file.metadata.hWidth ? `${file.metadata.hWidth}\u00B0` : ''],
    ['V Beamwidth', file.metadata.vWidth ? `${file.metadata.vWidth}\u00B0` : ''],
    ['Front/Back', file.metadata.frontToBack ? `${file.metadata.frontToBack} dB` : ''],
    ['Tilt', file.metadata.tilt],
    ['E-Tilt', file.metadata.electricalTilt ? `${file.metadata.electricalTilt}\u00B0` : ''],
    ['Polarization', file.metadata.polarization],
    ['Comment', file.metadata.comment],
  ];

  const visibleFields = fields.filter(([, val]) => val.trim() !== '');

  const extraEntries = Object.entries(file.metadata.extra);

  return (
    <div className="metadata-panel">
      <h3>Antenna Metadata</h3>
      <dl>
        {visibleFields.map(([label, value]) => (
          <div key={label} className="meta-row">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        {extraEntries.map(([key, value]) => (
          <div key={key} className="meta-row">
            <dt>{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="pattern-info">
        <span>{file.horizontal.length} H pts</span>
        <span>{file.vertical.length} V pts</span>
      </div>
    </div>
  );
}
