'use client';

import { useEffect, useState, useCallback } from 'react';

import { useCubeStudio } from '@/hooks/useCubeStudio';
import { useSolveMyCube } from '@/solve-my-cube/useSolveMyCube';
import SolveMyCubeView from '@/solve-my-cube/SolveMyCubeView';
import TopBar from './TopBar';
import CubeStage from './CubeStage';
import FaceControls from './FaceControls';
import MoveTapePanel from './MoveTapePanel';
import ConfigPanel from './ConfigPanel';
import ActionBar from './ActionBar';
import MetricsPanel from './MetricsPanel';
import SearchTreePanel from './SearchTreePanel';
import ShortcutsModal from './ShortcutsModal';

export default function Studio() {
  const [mode, setMode] = useState('explore'); // 'explore' | 'solve'
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const studio = useCubeStudio();
  const {
    containerRef,
    canvasRef,
    sceneRef,
    settings,
    status,
    engineState,
    tape,
    metrics,
    isSearching,
    activeStep,
    cameraView,
    copied,
    faceGroups,
    algorithms,
    algorithmLabels,
    heuristics,
    updateSetting,
    manualMove,
    scramble,
    extendScramble,
    applyCustomMoves,
    solve,
    stop,
    reset,
    previewStep,
    setView,
    resetCamera,
    copyTape,
  } = studio;

  const smc = useSolveMyCube({
    cubeSceneRef: sceneRef,
    setCameraView: setView,
  });

  // Handle 3D canvas sticker click painting in Solve My Cube mode
  const handleStageClick = useCallback(
    (clientX, clientY) => {
      if (mode !== 'solve') return;
      const slot = sceneRef.current?.pickStickerSlot(clientX, clientY);
      if (slot !== undefined && slot >= 0) {
        smc.paintSlot(slot);
      }
    },
    [mode, sceneRef, smc]
  );

  // When switching modes, synchronize 3D scene state
  useEffect(() => {
    if (mode === 'explore') {
      // Re-sync Explore model state to 3D cube
      resetCamera();
    } else if (mode === 'solve') {
      // Sync Solve My Cube stickers to 3D cube
      if (sceneRef.current) {
        sceneRef.current.syncToStateArray(
          smc.stickers.map((c) => (c >= 0 && c <= 5 ? c : 0))
        );
      }
    }
  }, [mode, resetCamera, sceneRef, smc.stickers]);

  /* ── Global keyboard shortcuts ───────────────────────────── */
  useEffect(() => {
    const handler = (e) => {
      const el = e.target;
      const typing =
        el instanceof HTMLElement &&
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing) {
        if (e.key === 'Escape') el.blur();
        return;
      }

      const plain = !e.ctrlKey && !e.metaKey;

      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((open) => !open);
        return;
      }
      if (e.key === 'Escape') {
        if (shortcutsOpen) setShortcutsOpen(false);
        else if (mode === 'explore') stop();
        else if (mode === 'solve') smc.stopSolving();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (mode === 'explore') {
          if (isSearching) stop();
          else solve();
        } else if (mode === 'solve') {
          if (smc.isSolving) smc.stopSolving();
          else if (smc.solutionSteps.length > 0) smc.playPause();
          else if (smc.validation.valid) smc.solve();
        }
        return;
      }

      if (mode === 'solve' && smc.solutionSteps.length > 0) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          smc.prevStep();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          smc.nextStep();
          return;
        }
      }

      // Explore shortcuts
      if (mode === 'explore') {
        if (plain && !e.altKey && (e.key === 's' || e.key === 'S')) {
          e.preventDefault();
          scramble(7);
          return;
        }
        if (plain && !e.altKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault();
          reset();
          return;
        }
        if (e.altKey && (e.key === 'r' || e.key === 'R')) {
          e.preventDefault();
          manualMove(e.shiftKey ? "R'" : 'R');
          return;
        }
        if (!e.altKey && (e.key === 'u' || e.key === 'U')) {
          e.preventDefault();
          manualMove(e.shiftKey ? "U'" : 'U');
          return;
        }
        if (!e.altKey && (e.key === 'f' || e.key === 'F')) {
          e.preventDefault();
          manualMove(e.shiftKey ? "F'" : 'F');
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [
    mode,
    shortcutsOpen,
    isSearching,
    solve,
    stop,
    scramble,
    reset,
    manualMove,
    smc,
  ]);

  return (
    <>
      <div className="app">
        <TopBar
          engineState={mode === 'solve' ? (smc.isSolving ? 'Solving…' : 'Solve My Cube') : engineState}
          statusKind={mode === 'solve' ? (smc.isSolving ? 'solving' : '') : status.kind}
          isSearching={isSearching || smc.isSolving}
          onReset={mode === 'solve' ? smc.clearAll : reset}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        <main className={`workspace ${mode === 'solve' ? 'workspace-solve' : ''}`}>
          <section className="pane pane-stage">
            {/* Mode Toggle at top of left panel */}
            <div className="mode-toggle-bar">
              <div className="segmented mode-segmented" role="tablist" aria-label="Mode">
                <button
                  type="button"
                  className={`seg-btn ${mode === 'explore' ? 'active' : ''}`}
                  onClick={() => setMode('explore')}
                  role="tab"
                  aria-selected={mode === 'explore'}
                >
                  Explore
                </button>
                <button
                  type="button"
                  className={`seg-btn ${mode === 'solve' ? 'active' : ''}`}
                  onClick={() => setMode('solve')}
                  role="tab"
                  aria-selected={mode === 'solve'}
                >
                  Solve My Cube
                </button>
              </div>
            </div>

            <CubeStage
              containerRef={containerRef}
              cameraView={cameraView}
              onView={setView}
              onResetCamera={resetCamera}
              onStageClick={handleStageClick}
              mode={mode}
            />

            {mode === 'explore' ? (
              <>
                <FaceControls
                  faceGroups={faceGroups}
                  onMove={manualMove}
                  disabled={isSearching}
                />
                <MoveTapePanel
                  tape={tape}
                  activeStep={activeStep}
                  onStep={previewStep}
                  onCopy={copyTape}
                  copied={copied}
                  status={status}
                  isSearching={isSearching}
                />
              </>
            ) : null}
          </section>

          {mode === 'explore' ? (
            <aside className="pane pane-controls">
              <ConfigPanel
                settings={settings}
                onSetting={updateSetting}
                algorithms={algorithms}
                algorithmLabels={algorithmLabels}
                heuristics={heuristics}
                isSearching={isSearching}
              />
              <ActionBar
                onScramble={scramble}
                onExtend={extendScramble}
                onCustom={applyCustomMoves}
                onSolve={solve}
                onStop={stop}
                isSearching={isSearching}
              />
              <MetricsPanel metrics={metrics} />
              <SearchTreePanel canvasRef={canvasRef} />
            </aside>
          ) : (
            <section className="pane pane-smc">
              <SolveMyCubeView
                smc={smc}
                algorithms={algorithms}
                algorithmLabels={algorithmLabels}
                heuristics={heuristics}
              />
            </section>
          )}
        </main>
      </div>

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
