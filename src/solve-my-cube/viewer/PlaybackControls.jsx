'use client';

import { useState } from 'react';

const SPEEDS = [0.5, 1, 2, 5];

export default function PlaybackControls({
  totalSteps = 0,
  currentStep = -1,
  isPlaying = false,
  isManualMode = false,
  speed = 1,
  onPlayPause,
  onPrev,
  onNext,
  onRestart,
  onScrub,
  onSpeedChange,
  onToggleManualMode,
  beginnerMode = false,
  onToggleBeginnerMode,
  userPerspective = false,
  onTogglePerspective,
  solutionMoves = [],
  onCopyNotation,
  copied = false,
}) {
  return (
    <div className="smc-playback-bar">
      {/* Top row: Orientation Hint & Toggles */}
      <div className="smc-hint-row">
        <div className="smc-orientation-banner">
          <span className="smc-compass-icon">🧭</span>
          <span className="smc-hint-text">
            <strong>Hold your cube:</strong> White on Top, Green in Front, Red on Right (Orange on Left, Yellow on Bottom).
          </span>
        </div>

        <div className="smc-toggles-cluster">
          <button
            type="button"
            className={`smc-toggle-chip ${userPerspective ? 'active' : ''}`}
            onClick={onTogglePerspective}
            title="Switch 3D camera to front-facing user hand perspective"
          >
            Perspective: {userPerspective ? 'Front (Hand)' : 'Isometric'}
          </button>

          <button
            type="button"
            className={`smc-toggle-chip ${isManualMode ? 'active' : ''}`}
            onClick={onToggleManualMode}
            title="Manual mode waits for you to press Next after executing each move on your real cube"
          >
            Mode: {isManualMode ? 'Step-by-Step (Manual)' : 'Auto-Play'}
          </button>

          <button
            type="button"
            className={`smc-toggle-chip ${beginnerMode ? 'active' : ''}`}
            onClick={onToggleBeginnerMode}
            title="View grouped beginner method explanation with educational phases"
          >
            Beginner Breakdown {beginnerMode ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {beginnerMode && (
        <div className="smc-beginner-notice">
          <span className="smc-notice-badge">Educational Breakdown</span>
          <span>
            Moves are partitioned into 3 intuitive phases (Base Layer, Top Orientation OLL, Corner Permutation PLL). Note: Optimal search moves are grouped for learning.
          </span>
        </div>
      )}

      {/* Scrubber slider */}
      <div className="smc-scrubber-row">
        <span className="smc-step-counter">
          {currentStep >= 0 ? currentStep + 1 : 0} / {totalSteps}
        </span>
        <input
          type="range"
          min={-1}
          max={totalSteps - 1}
          value={currentStep}
          onChange={(e) => onScrub(Number(e.target.value))}
          className="smc-slider"
          aria-label="Seek solution step"
          disabled={totalSteps === 0}
        />
        <span className="smc-step-total">
          {totalSteps} move{totalSteps !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Controls row */}
      <div className="smc-controls-row">
        <div className="smc-playback-buttons">
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={onRestart}
            disabled={totalSteps === 0 || currentStep === -1}
            title="Restart from beginning (Step 0)"
            aria-label="Restart"
          >
            ⏮ Restart
          </button>

          <button
            type="button"
            className="btn-subtle btn-sm"
            onClick={onPrev}
            disabled={totalSteps === 0 || currentStep <= -1}
            title="Previous step (Left Arrow)"
            aria-label="Previous step"
          >
            ◀ Prev
          </button>

          <button
            type="button"
            className="btn-accent btn-sm smc-play-btn"
            onClick={onPlayPause}
            disabled={totalSteps === 0}
            title="Play / Pause (Spacebar)"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>

          <button
            type="button"
            className="btn-subtle btn-sm"
            onClick={onNext}
            disabled={totalSteps === 0 || currentStep >= totalSteps - 1}
            title="Next step (Right Arrow)"
            aria-label="Next step"
          >
            Next ▶
          </button>
        </div>

        {/* Speed selectors */}
        <div className="smc-speed-group" role="radiogroup" aria-label="Playback speed">
          <span className="smc-speed-label">Speed:</span>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              className={`smc-speed-btn ${speed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
              role="radio"
              aria-checked={speed === s}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Notation summary & Copy button */}
        <div className="smc-notation-summary">
          <span className="smc-notation-code" title={solutionMoves.join(' ')}>
            {solutionMoves.join(' ')}
          </span>
          <button
            type="button"
            className="btn-ghost btn-sm smc-copy-btn"
            onClick={onCopyNotation}
            disabled={solutionMoves.length === 0}
            title="Copy move notation to clipboard"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
