'use client';

import { useState } from 'react';
import { PlayIcon, StopIcon } from './icons';

const SCRAMBLES = [4, 7, 10];
const EXTENSIONS = [5, 10];

export default function ActionBar({ onScramble, onExtend, onCustom, onSolve, onStop, isSearching }) {
  const [value, setValue] = useState('');

  const submit = () => {
    if (onCustom(value)) setValue('');
  };

  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">Run</span>
      </div>

      <div className="run-row">
        <span className="run-label">Scramble</span>
        {SCRAMBLES.map((depth) => (
          <button
            key={depth}
            type="button"
            className="btn btn-sm"
            onClick={() => onScramble(depth)}
            disabled={isSearching}
            title={`New ${depth}-turn scramble from solved`}
          >
            {depth} moves
          </button>
        ))}
        <span className="run-divider" aria-hidden="true" />
        {EXTENSIONS.map((count) => (
          <button
            key={count}
            type="button"
            className="btn btn-sm"
            onClick={() => onExtend(count)}
            disabled={isSearching}
            title={`Add ${count} more turns to the current sequence`}
          >
            +{count}
          </button>
        ))}
      </div>

      <div className="run-row">
        <input
          className="run-input"
          type="text"
          placeholder="Notation, e.g. U R2 F' U'"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          autoComplete="off"
          spellCheck={false}
          disabled={isSearching}
          aria-label="Custom move notation"
        />
        <button
          type="button"
          className="btn"
          onClick={submit}
          disabled={isSearching || !value.trim()}
        >
          Apply
        </button>
      </div>

      <div className="run-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onSolve}
          disabled={isSearching}
          title="Run the search (Space)"
        >
          <PlayIcon size={13} />
          {isSearching ? 'Solving' : 'Solve'}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={onStop}
          disabled={!isSearching}
          title="Stop the search (Esc)"
        >
          <StopIcon size={11} />
          Stop
        </button>
      </div>
    </div>
  );
}
