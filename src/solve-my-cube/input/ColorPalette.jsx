'use client';

import { PALETTE, UNSET_ID } from '../constants.js';

export default function ColorPalette({
  selectedColor,
  onSelectColor,
  counts,
  onClearAll,
  onFillFace,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  colorBlind,
  onToggleColorBlind,
  onOpenPhotoAssist,
  onRandomValid,
  onScrambleOwn,
}) {
  return (
    <div className="smc-palette-panel">
      <div className="smc-panel-header">
        <span className="smc-panel-title">Color Palette</span>
        <div className="smc-header-actions">
          <button
            type="button"
            className={`smc-tool-btn ${colorBlind ? 'active' : ''}`}
            onClick={onToggleColorBlind}
            title="Toggle color-blind text labels (W, Y, R, O, G, B)"
            aria-pressed={colorBlind}
          >
            Letters {colorBlind ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className="smc-palette-grid" role="radiogroup" aria-label="Select paint color">
        {PALETTE.map((p) => {
          const count = counts[p.id] || 0;
          const isSelected = selectedColor === p.id;
          const isDone = count === 4;
          const isOver = count > 4;

          return (
            <button
              key={p.id}
              type="button"
              className={`smc-palette-btn ${isSelected ? 'selected' : ''}`}
              style={{ '--swatch-color': p.color }}
              onClick={() => onSelectColor(p.id)}
              aria-label={`${p.name} color: ${count} of 4 painted`}
              aria-checked={isSelected}
              role="radio"
            >
              <span className="smc-swatch">
                {colorBlind && <span className="smc-swatch-code">{p.code}</span>}
              </span>
              <div className="smc-swatch-info">
                <span className="smc-swatch-name">{p.name}</span>
                <span
                  className={`smc-swatch-count ${isDone ? 'done' : ''} ${isOver ? 'over' : ''}`}
                >
                  {count}/4 {isDone ? '✓' : ''}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="smc-actions-row">
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo last sticker paint (Ctrl+Z)"
        >
          ↶ Undo
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo sticker paint (Ctrl+Y)"
        >
          ↷ Redo
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={onFillFace}
          title="Fill the currently front-facing side with the active color"
        >
          Fill Face
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm smc-danger-text"
          onClick={onClearAll}
          title="Clear all stickers back to unset grey"
        >
          Clear All
        </button>
      </div>

      <div className="smc-extra-row">
        <button
          type="button"
          className="btn-subtle btn-sm"
          onClick={onRandomValid}
          title="Generate a random solvable scramble for quick testing"
        >
          🎲 Demo Scramble
        </button>
        <button
          type="button"
          className="btn-subtle btn-sm"
          onClick={onScrambleOwn}
          title="Set state using custom notation like U R2 F'"
        >
          ⌨ Enter Moves
        </button>
        <button
          type="button"
          className="btn-accent btn-sm"
          onClick={onOpenPhotoAssist}
          title="Upload face photos or use camera to detect colors"
        >
          📷 Photo Assist
        </button>
      </div>
    </div>
  );
}
