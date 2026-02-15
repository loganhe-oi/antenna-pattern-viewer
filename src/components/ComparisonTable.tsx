import { useMemo } from 'react';
import type { MsiFile } from '../types/msi';
import type { ComputedFileData } from '../lib/beamwidth';
import { getRowDefs } from '../lib/exportUtils';
import './ComparisonTable.css';

interface ComparisonTableProps {
  files: MsiFile[];
  comparisonData: ComputedFileData[];
}

/** Rows where higher numeric value is better */
const HIGHER_IS_BETTER = new Set(['Gain (dBi)', 'Front-to-Back (dB)']);

/** Rows that should be highlighted */
const HIGHLIGHTABLE = new Set(['Gain (dBi)', 'Front-to-Back (dB)']);

function parseNumeric(val: string): number | null {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

export default function ComparisonTable({ files, comparisonData }: ComparisonTableProps) {
  const rows = useMemo(() => getRowDefs(), []);

  const grid = useMemo(() => {
    return rows.map(row => {
      const values = files.map((f, i) => row.getValue(f, comparisonData[i]));
      let bestIdx: number | null = null;
      let worstIdx: number | null = null;

      if (HIGHLIGHTABLE.has(row.label) && files.length >= 2) {
        const nums = values.map(parseNumeric);
        const validNums = nums.filter((n): n is number => n !== null);
        if (validNums.length >= 2) {
          const max = Math.max(...validNums);
          const min = Math.min(...validNums);
          if (max !== min) {
            const higherBetter = HIGHER_IS_BETTER.has(row.label);
            bestIdx = nums.indexOf(higherBetter ? max : min);
            worstIdx = nums.indexOf(higherBetter ? min : max);
          }
        }
      }

      return { label: row.label, values, bestIdx, worstIdx };
    });
  }, [rows, files, comparisonData]);

  return (
    <div className="comparison-table-wrapper">
      <table className="comparison-table">
        <thead>
          <tr>
            <th>Parameter</th>
            {files.map(f => (
              <th key={f.id}>
                <div className="antenna-header">
                  <span className="color-dot" style={{ backgroundColor: f.color }} />
                  <span>{f.metadata.name || f.fileName}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.map(row => (
            <tr key={row.label}>
              <td>{row.label}</td>
              {row.values.map((val, ci) => (
                <td
                  key={ci}
                  className={
                    ci === row.bestIdx ? 'cell-best' :
                    ci === row.worstIdx ? 'cell-worst' : ''
                  }
                >
                  {val}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
