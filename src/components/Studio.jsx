'use client';

import { useEffect, useState } from 'react';

import { useCubeStudio } from '@/hooks/useCubeStudio';
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
  const studio = useCubeStudio();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const {
    containerRef,
    canvasRef,
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
        else stop();
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (isSearching) stop();
        else solve();
        return;
      }
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
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [shortcutsOpen, isSearching, solve, stop, scramble, reset, manualMove]);

  return (
    <>
      <div className="app">
        <TopBar
          engineState={engineState}
          statusKind={status.kind}
          isSearching={isSearching}
          onReset={reset}
          onOpenShortcuts={() => setShortcutsOpen(true)}
        />

        <main className="workspace">
          <section className="pane pane-stage">
            <CubeStage
              containerRef={containerRef}
              cameraView={cameraView}
              onView={setView}
              onResetCamera={resetCamera}
            />
            <FaceControls faceGroups={faceGroups} onMove={manualMove} disabled={isSearching} />
            <MoveTapePanel
              tape={tape}
              activeStep={activeStep}
              onStep={previewStep}
              onCopy={copyTape}
              copied={copied}
              status={status}
              isSearching={isSearching}
            />
          </section>

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
        </main>
      </div>

      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}
