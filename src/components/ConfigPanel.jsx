'use client';

import { ChevronIcon } from './icons';

const MODES = [
  ['instant', 'Instant solve, then animate'],
  ['live', 'Live search, step by step'],
];

const SPEED_PRESETS = [0.5, 1, 2.5, 5];

const ALGORITHM_HINT = {
  astar: 'optimal',
  ida: 'depth-first',
  greedy: 'fast, not optimal',
};

const HEURISTIC_HINT = {
  h2: 'admissible',
  h1: 'admissible',
  h0: 'uninformed',
};

function Select({ id, label, value, onChange, options, disabled }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="select-wrap">
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {options.map(([val, text]) => (
            <option key={val} value={val}>
              {text}
            </option>
          ))}
        </select>
        <span className="select-arrow">
          <ChevronIcon size={12} />
        </span>
      </div>
    </div>
  );
}

export default function ConfigPanel({ settings, onSetting, algorithms, algorithmLabels, heuristics, isSearching }) {
  const { algorithm, heuristic, mode, speed } = settings;
  const pct = ((speed - 0.25) / (10 - 0.25)) * 100;
  const speedLabel = `${speed.toFixed(2).replace(/\.?0+$/, '')}×`;

  const algorithmOptions = algorithms.map((id) => [
    id,
    `${algorithmLabels[id]} — ${ALGORITHM_HINT[id] || ''}`.trim(),
  ]);

  const heuristicOptions = Object.values(heuristics).map((h) => [
    h.id,
    `${h.label} · ${HEURISTIC_HINT[h.id] || ''}`.trim(),
  ]);

  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">Search</span>
      </div>

      <div className="field-grid">
        <Select
          id="algorithm"
          label="Algorithm"
          value={algorithm}
          onChange={(v) => onSetting({ algorithm: v })}
          options={algorithmOptions}
          disabled={isSearching}
        />
        <Select
          id="heuristic"
          label="Heuristic"
          value={heuristic}
          onChange={(v) => onSetting({ heuristic: v })}
          options={heuristicOptions}
          disabled={isSearching}
        />
        <Select
          id="mode"
          label="Mode"
          value={mode}
          onChange={(v) => onSetting({ mode: v })}
          options={MODES}
          disabled={isSearching}
        />

        <div className="field">
          <label className="field-label" htmlFor="speed">
            Speed
          </label>
          <div className="field-row">
            <div className="presets">
              {SPEED_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset ${Math.abs(preset - speed) < 0.05 ? 'active' : ''}`}
                  onClick={() => onSetting({ speed: preset })}
                >
                  {preset}×
                </button>
              ))}
            </div>
            <span className="speed-value">{speedLabel}</span>
          </div>
        </div>

        <div className="field field-wide">
          <input
            className="range"
            id="speed"
            type="range"
            min="0.25"
            max="10"
            step="0.25"
            value={speed}
            onChange={(e) => onSetting({ speed: Number.parseFloat(e.target.value) })}
            style={{ '--pct': `${pct}%` }}
            aria-label="Playback speed"
          />
        </div>
      </div>
    </div>
  );
}
