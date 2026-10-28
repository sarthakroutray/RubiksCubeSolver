'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { UNSET_ID, STORAGE_KEY } from './constants.js';
import { validateCube } from './validation/validateCube.js';
import { SolveSession } from './solver-adapter/solveAdapter.js';
import { annotateBeginnerPhases } from './solver-adapter/beginnerMethod.js';
import { applyMove, applyMoves, solvedState, scramble } from '../core/CubeState.js';
import { SearchTreeCanvas } from '../visualizer/SearchTreeCanvas.js';

export function useSolveMyCube({ cubeSceneRef, setCameraView, enabled = false }) {
  // 24 stickers (initialized to UNSET_ID)
  const [stickers, setStickers] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length === 24) return parsed;
        }
      } catch {}
    }
    return Array(24).fill(UNSET_ID);
  });

  const [selectedColor, setSelectedColor] = useState(0); // White
  const [colorBlind, setColorBlind] = useState(false);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Solving & Solution states
  const [isSolving, setIsSolving] = useState(false);
  const [solveProgress, setSolveProgress] = useState(null);
  const [solutionSteps, setSolutionSteps] = useState([]); // [{ move, stateAfter }]
  const [solutionMoves, setSolutionMoves] = useState([]);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [userPerspective, setUserPerspective] = useState(false);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [photoAssistOpen, setPhotoAssistOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [solveStats, setSolveStats] = useState({ nodes: 0, elapsedMs: 0, algorithm: 'A*' });

  const treeRef = useRef(null);
  const cleanupTreeRef = useRef(null);

  const treeCanvasRef = useCallback((canvas) => {
    if (cleanupTreeRef.current) {
      cleanupTreeRef.current();
      cleanupTreeRef.current = null;
    }
    if (!canvas) {
      treeRef.current = null;
      return;
    }
    const tree = new SearchTreeCanvas(canvas, {
      onNodeClick: (node) => {
        if (node?.state && cubeSceneRef.current) {
          cubeSceneRef.current.syncToStateArray(node.state);
        }
      },
    });
    treeRef.current = tree;

    const observer = new ResizeObserver(() => {
      if (treeRef.current === tree) tree.resize();
    });
    observer.observe(canvas);
    const onResize = () => {
      if (treeRef.current === tree) tree.resize();
    };
    window.addEventListener('resize', onResize);

    cleanupTreeRef.current = () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      if (typeof tree.dispose === 'function') tree.dispose();
      if (treeRef.current === tree) treeRef.current = null;
    };
  }, [cubeSceneRef]);

  useEffect(() => {
    return () => {
      if (cleanupTreeRef.current) {
        cleanupTreeRef.current();
        cleanupTreeRef.current = null;
      }
    };
  }, []);
  const sessionRef = useRef(null);
  const playTimerRef = useRef(null);
  const stickersRef = useRef(stickers);
  stickersRef.current = stickers;

  // Validation
  const validation = validateCube(stickers);

  // Persist stickers in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stickers));
    } catch {}
  }, [stickers]);

  // Sync painted stickers with 3D cube model when in solve mode and not in solution playback
  useEffect(() => {
    if (!enabled) return;
    if (activeStepIndex === -1 && cubeSceneRef.current) {
      cubeSceneRef.current.syncToStateArray(stickers);
    }
  }, [enabled, stickers, activeStepIndex, cubeSceneRef]);

  /* ── History & Painting ────────────────────────────────────────────── */
  const pushState = useCallback((newStickers) => {
    setHistory((prev) => [...prev.slice(-30), stickersRef.current]);
    setRedoStack([]);
    setStickers(newStickers);
  }, []);

  const paintSlot = useCallback(
    (slot, color = selectedColor) => {
      if (slot < 0 || slot >= 24) return;
      if (stickersRef.current[slot] === color) return;
      const next = [...stickersRef.current];
      next[slot] = color;
      pushState(next);
    },
    [selectedColor, pushState]
  );

  const fillFace = useCallback(
    (faceId = 0, color = selectedColor) => {
      // Find the 4 slots of faceId: [faceId*4, faceId*4+1, faceId*4+2, faceId*4+3]
      const next = [...stickersRef.current];
      for (let i = 0; i < 4; i++) {
        next[faceId * 4 + i] = color;
      }
      pushState(next);
    },
    [selectedColor, pushState]
  );

  const clearAll = useCallback(() => {
    pushState(Array(24).fill(UNSET_ID));
    setSolutionSteps([]);
    setSolutionMoves([]);
    setActiveStepIndex(-1);
    setIsPlaying(false);
  }, [pushState]);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedoStack((r) => [...r, stickersRef.current]);
    setStickers(prev);
  }, [history]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((r) => r.slice(0, -1));
    setHistory((h) => [...h, stickersRef.current]);
    setStickers(next);
  }, [redoStack]);

  /* ── Demo & Scramble Own ───────────────────────────────────────────── */
  const setRandomValid = useCallback(() => {
    const { state } = scramble(7);
    pushState(state);
    setSolutionSteps([]);
    setSolutionMoves([]);
    setActiveStepIndex(-1);
  }, [pushState]);

  const applyCustomMoves = useCallback(
    (text) => {
      const tokens = text.trim().split(/\s+/).filter(Boolean);
      const invalid = tokens.filter((t) => !/^[URF](2|')?$/.test(t));
      if (invalid.length > 0) return false;
      const state = applyMoves(solvedState(), tokens);
      pushState(state);
      setSolutionSteps([]);
      setSolutionMoves([]);
      setActiveStepIndex(-1);
      return true;
    },
    [pushState]
  );

  /* ── Solving ───────────────────────────────────────────────────────── */
  const solve = useCallback(
    async (options = {}) => {
      const val = validateCube(stickersRef.current);
      if (!val.valid || !val.normalizedState) return;

      if (val.isSolved) {
        setSolutionSteps([]);
        setSolutionMoves([]);
        setCelebrationOpen(true);
        return;
      }

      setIsSolving(true);
      setIsPlaying(false);
      treeRef.current?.reset();
      sessionRef.current?.abort();
      const session = new SolveSession();
      sessionRef.current = session;

      try {
        const result = await session.run(
          val.normalizedState,
          {
            algorithm: options.algorithm || 'astar',
            heuristic: options.heuristic || 'h2',
            maxNodes: 1_500_000,
            yieldEvery: 1,
          },
          (frame) => {
            treeRef.current?.addFrame(frame);
            setSolveProgress({
              expanded: frame.closedSetCount,
              frontier: frame.openSetCount,
              g: frame.currentNode.g,
              h: frame.currentNode.h,
              f: frame.currentNode.f,
            });
          }
        );

        if (result && result.solution) {
          treeRef.current?.markSolution();
          const moves = result.solution;
          let curr = [...val.normalizedState];
          const steps = [];
          for (const m of moves) {
            curr = applyMove(curr, m);
            steps.push({ move: m, stateAfter: curr });
          }

          setSolutionMoves(moves);
          setSolutionSteps(steps);
          setSolveStats({
            nodes: result.nodesExpanded,
            elapsedMs: result.elapsedMs || 0,
            algorithm: result.algorithm || 'A*',
          });
          setActiveStepIndex(0);
          // Sync 3D scene to step 0
          cubeSceneRef.current?.syncToStateArray(steps[0].stateAfter);
        }
      } catch (err) {
        console.error('Solve error:', err);
      } finally {
        setIsSolving(false);
      }
    },
    [cubeSceneRef]
  );

  const stopSolving = useCallback(() => {
    sessionRef.current?.abort();
    setIsSolving(false);
  }, []);

  /* ── Playback Controls ─────────────────────────────────────────────── */
  const selectStep = useCallback(
    (index) => {
      setIsPlaying(false);
      if (index < -1 || index >= solutionSteps.length) return;
      setActiveStepIndex(index);
      if (index === -1) {
        // Show initial normalized scramble or painted stickers
        if (validation.normalizedState && cubeSceneRef.current) {
          cubeSceneRef.current.syncToStateArray(validation.normalizedState);
        } else if (cubeSceneRef.current) {
          cubeSceneRef.current.syncToStateArray(stickers);
        }
      } else {
        const step = solutionSteps[index];
        cubeSceneRef.current?.syncToStateArray(step.stateAfter);
      }
    },
    [solutionSteps, validation.normalizedState, cubeSceneRef]
  );

  const prevStep = useCallback(() => {
    selectStep(Math.max(-1, activeStepIndex - 1));
  }, [activeStepIndex, selectStep]);

  const nextStep = useCallback(() => {
    const nextIdx = activeStepIndex + 1;
    if (nextIdx < solutionSteps.length) {
      selectStep(nextIdx);
      if (nextIdx === solutionSteps.length - 1) {
        setCelebrationOpen(true);
      }
    }
  }, [activeStepIndex, solutionSteps.length, selectStep]);

  const restartPlayback = useCallback(() => {
    selectStep(-1);
  }, [selectStep]);

  const playPause = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  // Automatic playback ticker
  useEffect(() => {
    if (!isPlaying || isManualMode) {
      clearTimeout(playTimerRef.current);
      return;
    }

    const duration = Math.max(80, 500 / speed);
    playTimerRef.current = setTimeout(async () => {
      if (activeStepIndex < solutionSteps.length - 1) {
        const nextIdx = activeStepIndex + 1;
        const move = solutionSteps[nextIdx].move;
        setActiveStepIndex(nextIdx);

        // Animate move in 3D scene
        if (cubeSceneRef.current) {
          await cubeSceneRef.current.queueMove(move, duration);
        }

        if (nextIdx === solutionSteps.length - 1) {
          setIsPlaying(false);
          setCelebrationOpen(true);
        }
      } else {
        setIsPlaying(false);
      }
    }, duration);

    return () => clearTimeout(playTimerRef.current);
  }, [isPlaying, isManualMode, activeStepIndex, solutionSteps, speed, cubeSceneRef]);

  /* ── Perspective Toggle ────────────────────────────────────────────── */
  const togglePerspective = useCallback(() => {
    setUserPerspective((prev) => {
      const next = !prev;
      if (typeof setCameraView === 'function') {
        setCameraView(next ? 'front' : 'iso');
      }
      return next;
    });
  }, [setCameraView]);

  /* ── Copy Notation ─────────────────────────────────────────────────── */
  const copyNotation = useCallback(async () => {
    if (solutionMoves.length === 0) return;
    try {
      await navigator.clipboard.writeText(solutionMoves.join(' '));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }, [solutionMoves]);

  const beginnerPhases = beginnerMode
    ? annotateBeginnerPhases(solutionMoves)
    : [];

  return {
    stickers,
    selectedColor,
    setSelectedColor,
    colorBlind,
    setColorBlind: () => setColorBlind((c) => !c),
    canUndo: history.length > 0,
    canRedo: redoStack.length > 0,
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
    setIsManualMode: () => setIsManualMode((m) => !m),
    speed,
    setSpeed,
    beginnerMode,
    setBeginnerMode: () => setBeginnerMode((b) => !b),
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
    treeCanvasRef,
  };
}
