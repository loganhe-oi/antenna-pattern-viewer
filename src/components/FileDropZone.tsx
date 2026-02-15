import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import './FileDropZone.css';

interface FileDropZoneProps {
  onFileParsed: (content: string, fileName: string) => void;
}

export default function FileDropZone({ onFileParsed }: FileDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function readFiles(files: FileList) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onFileParsed(reader.result, file.name);
        }
      };
      reader.readAsText(file);
    });
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      readFiles(e.dataTransfer.files);
    }
  }

  function handleClick() {
    inputRef.current?.click();
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      readFiles(e.target.files);
      e.target.value = '';
    }
  }

  return (
    <div
      className={`file-drop-zone ${dragOver ? 'drag-over' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".msi,.txt,.nsma,.adf,.pla,.pln,.pat,.xml,.json"
        multiple
        onChange={handleChange}
        hidden
      />
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <p className="drop-text">Drop antenna pattern files here</p>
      <p className="drop-hint">or click to browse</p>
    </div>
  );
}
