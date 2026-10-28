'use client';

import { useState } from 'react';
import ColorPalette from './input/ColorPalette.jsx';
import CubeNetView from './input/CubeNetView.jsx';
import CameraAssistModal from './input/CameraAssistModal.jsx';
import StepCardGrid from './viewer/StepCardGrid.jsx';
import PlaybackControls from './viewer/PlaybackControls.jsx';
import CelebrationModal from './viewer/CelebrationModal.jsx';

export default function SolveMyCubeView({ smc, algorithms, algorithmLabels, heuristics }) {
  const [customMoveInput, setCustomMoveInput] = useState('');
  const [customMoveOpen, setCustomMoveOpen] = useState(false);
  const [selectedAlg, setSelectedAlg] = useState('astar');
  const [selectedH, setSelectedH] = useState('h2');

  const {
    stickers,
    selectedColor,
    setSelectedColor,
    colorBlind,
    setColorBlind,
    canUndo,
    canRedo,
    paintSlot,
    fillFace,
    clearAll,
    undo,
    redo,
    setRandomValid,
    applyCustomMoves,
    validation,
    isSolving,
    solveProgress,
    solve,
    stopSolving,
    solutionSteps,
    solutionMoves,
    activeStepIndex,
    selectStep,
    prevStep,
    nextStep,
    restartPlayback,
    isPlaying,
    playPause,
    isManualMode,
    setIsManualMode,
    speed,
    setSpeed,
    beginnerMode,
    setBeginnerMode,
    beginnerPhases,
    userPerspective,
    togglePerspective,
    celebrationOpen,
    setCelebrationOpen,
    photoAssistOpen,
    setPhotoAssistOpen,
    copied,
    copyNotation,
    solveStats,
  } = smc;

  const handleCustomMovesSubmit = (e) => {
    e.preventDefault();
    if (applyCustomMoves(customMoveInput)) {
      setCustomMoveOpen(false);
      setCustomMoveInput('');
    } else {
      alert("Invalid move notation. Use standard moves: U, U', U2, R, R', R2, F, F', F2");
    }
  };

  return (
    <div className="smc-container">
      {/* ── Left Column: Color Input, Net View & Validation ── */}
      <div className="smc-sidebar">
        <ColorPalette
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          counts={validation.counts}
          onClearAll={clearAll}
          onFillFace={() => fillFace(0, selectedColor)}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          colorBlind={colorBlind}
          onToggleColorBlind={setColorBlind}
          onOpenPhotoAssist={() => setPhotoAssistOpen(true)}
          onRandomValid={setRandomValid}
          onScrambleOwn={() => setCustomMoveOpen(true)}
        />

        {/* 2D Unfolded Net View */}
        <CubeNetView
          stickers={stickers}
          onPaintSlot={paintSlot}
          selectedColor={selectedColor}
          offendingSlots={validation.offendingSlots}
          colorBlind={colorBlind}
        />

        {/* Validation & Solve Action Bar */}
        <div className="smc-validation-bar">
          {validation.error ? (
            <div className="smc-alert smc-alert-danger" role="alert">
              <span className="smc-alert-icon">⚠️</span>
              <div className="smc-alert-content">
                <strong>Validation Issue:</strong> {validation.error}
              </div>
            </div>
          ) : validation.valid ? (
            <div className="smc-alert smc-alert-success">
              <span className="smc-alert-icon">✓</span>
              <div className="smc-alert-content">
                <strong>Cube State Valid:</strong>{' '}
                {validation.isSolved
                  ? 'Your cube is already solved!'
                  : 'Ready to compute optimal solution.'}
              </div>
            </div>
          ) : null}

          {/* Solver Configuration */}
          <div className="smc-solver-config-row">
            <div className="smc-config-field">
              <label htmlFor="smc-alg-select">Algorithm</label>
              <select
                id="smc-alg-select"
                value={selectedAlg}
                onChange={(e) => setSelectedAlg(e.target.value)}
                disabled={isSolving}
              >
                {algorithms.map((a) => (
                  <option key={a} value={a}>
                    {algorithmLabels[a] || a}
                  </option>
                ))}
              </select>
            </div>

            <div className="smc-config-field">
              <label htmlFor="smc-h-select">Heuristic</label>
              <select
                id="smc-h-select"
                value={selectedH}
                onChange={(e) => setSelectedH(e.target.value)}
                disabled={isSolving}
              >
                {Object.entries(heuristics).map(([id, meta]) => (
                  <option key={id} value={id}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="smc-solve-action">
            {isSolving ? (
              <button
                type="button"
                className="btn-danger smc-solve-main-btn"
                onClick={stopSolving}
              >
                ⏹ Cancel Search
              </button>
            ) : (
              <button
                type="button"
                className="btn-accent smc-solve-main-btn"
                onClick={() =>
                  solve({ algorithm: selectedAlg, heuristic: selectedH })
                }
                disabled={!validation.valid || validation.isSolved}
              >
                ⚡ Solve My Cube
              </button>
            )}
          </div>

          {isSolving && solveProgress && (
            <div className="smc-solve-progress">
              <span>Evaluating: {solveProgress.expanded.toLocaleString()} nodes</span>
              <span>Frontier: {solveProgress.frontier.toLocaleString()}</span>
              <span>Depth: {solveProgress.g} · h: {solveProgress.h.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main View: Step Cards Grid & Playback Controls ── */}
      <div className="smc-solution-section">
        <div className="smc-solution-header">
          <div className="smc-solution-heading">
            <span className="smc-badge-pill">Step-By-Step Solution</span>
            {solutionMoves.length > 0 && (
              <span className="smc-solution-moves-count">
                {solutionMoves.length} moves ({solveStats.algorithm} · {solveStats.elapsedMs}ms)
              </span>
            )}
          </div>
        </div>

        {/* Graphical Step Cards Grid */}
        <StepCardGrid
          steps={solutionSteps}
          activeStepIndex={activeStepIndex}
          onSelectStep={selectStep}
          beginnerMode={beginnerMode}
          beginnerPhases={beginnerPhases}
        />

        {/* Playback & Scrubbing Controls */}
        <PlaybackControls
          totalSteps={solutionSteps.length}
          currentStep={activeStepIndex}
          isPlaying={isPlaying}
          isManualMode={isManualMode}
          speed={speed}
          onPlayPause={playPause}
          onPrev={prevStep}
          onNext={nextStep}
          onRestart={restartPlayback}
          onScrub={selectStep}
          onSpeedChange={setSpeed}
          onToggleManualMode={setIsManualMode}
          beginnerMode={beginnerMode}
          onToggleBeginnerMode={setBeginnerMode}
          userPerspective={userPerspective}
          onTogglePerspective={togglePerspective}
          solutionMoves={solutionMoves}
          onCopyNotation={copyNotation}
          copied={copied}
        />
      </div>

      {/* ── Modals ── */}
      <CelebrationModal
        open={celebrationOpen}
        onClose={() => setCelebrationOpen(false)}
        onVerifyReplay={() => {
          setCelebrationOpen(false);
          restartPlayback();
          playPause();
        }}
        moveCount={solutionMoves.length}
        algorithm={solveStats.algorithm}
        elapsedMs={solveStats.elapsedMs}
      />

      <CameraAssistModal
        open={photoAssistOpen}
        onClose={() => setPhotoAssistOpen(false)}
        onApplyDetected={(detectedStickers) => {
          // Replace stickers with detected values
          for (let i = 0; i < 24; i++) {
            if (detectedStickers[i] >= 0) {
              paintSlot(i, detectedStickers[i]);
            }
          }
        }}
        currentStickers={stickers}
      />

      {/* Custom Moves Modal */}
      {customMoveOpen && (
        <div className="smc-modal-overlay" role="dialog" aria-modal="true">
          <div className="smc-modal-card">
            <h3>Enter Custom Scramble Moves</h3>
            <p className="smc-modal-desc">
              Type valid Singmaster notation moves separated by spaces (e.g. <code>U R2 F' U' R</code>):
            </p>
            <form onSubmit={handleCustomMovesSubmit}>
              <input
                type="text"
                className="input-text smc-input"
                placeholder="e.g. U R2 F' U' R"
                value={customMoveInput}
                onChange={(e) => setCustomMoveInput(e.target.value)}
                autoFocus
              />
              <div className="smc-modal-actions">
                <button type="submit" className="btn-accent">
                  Apply State
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setCustomMoveOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
