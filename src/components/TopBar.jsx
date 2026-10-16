'use client';

import { CubeIcon, ResetIcon, KeyboardIcon } from './icons';

export default function TopBar({ engineState, statusKind, isSearching, onReset, onOpenShortcuts }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <CubeIcon size={18} />
        </span>
        <span className="brand-name">PocketCube</span>
        <span className="brand-sep">/</span>
        <span className="brand-sub">State space search lab</span>
      </div>

      <div className="topbar-actions">
        <div className="status" data-kind={statusKind} role="status" aria-live="polite">
          <span className="status-dot" />
          <span className="status-text">{engineState}</span>
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={onReset}
          disabled={isSearching}
          title="Reset the cube to a solved state (R)"
        >
          <ResetIcon size={14} />
          Reset
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={onOpenShortcuts}
          title="Keyboard shortcuts (?)"
        >
          <KeyboardIcon size={14} />
          Shortcuts
          <kbd>?</kbd>
        </button>
      </div>
    </header>
  );
}
