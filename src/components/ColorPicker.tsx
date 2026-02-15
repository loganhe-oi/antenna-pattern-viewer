import { useEffect, useRef, useState } from 'react';
import { PLOT_COLORS } from '../constants/plotColors';
import './ColorPicker.css';

const EXTRA_COLORS = ['#2d3436', '#636e72', '#fdcb6e', '#00b894', '#6c5ce7', '#fd79a8'];
const ALL_SWATCHES = [...PLOT_COLORS, ...EXTRA_COLORS];

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export default function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(color);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHex(color);
  }, [color]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleSwatchClick(c: string) {
    onChange(c);
    setOpen(false);
  }

  function handleHexChange(value: string) {
    setHex(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      onChange(value);
    }
  }

  return (
    <div className="color-picker-anchor" ref={popoverRef}>
      <span
        className="color-picker-dot"
        style={{ backgroundColor: color }}
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
      />
      {open && (
        <div className="color-picker-popover" onClick={e => e.stopPropagation()}>
          <div className="color-picker-swatches">
            {ALL_SWATCHES.map(c => (
              <span
                key={c}
                className={`color-swatch ${c === color ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => handleSwatchClick(c)}
              />
            ))}
          </div>
          <div className="color-picker-hex">
            <label>Hex</label>
            <input
              type="text"
              value={hex}
              onChange={e => handleHexChange(e.target.value)}
              maxLength={7}
            />
          </div>
        </div>
      )}
    </div>
  );
}
