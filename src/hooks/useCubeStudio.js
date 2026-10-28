'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { CubeScene } from '@/three/CubeScene';
import { SearchTreeCanvas } from '@/visualizer/SearchTreeCanvas';
import { search, ALGORITHM_LABELS, ALGORITHMS } from '@/solver/SearchEngine';
import { HEURISTICS } from '@/solver/heuristics';
import {
  solvedState,
  applyMove,
  applyMoves,
  randomMoves,
  scramble as generateScramble,
  isSolved,
} from '@/core/CubeState';

const UI_MAX_NODES = 1_000_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function computeBranchingFactor(nodesExpanded, depth) {
  if (!depth || depth < 1 || !nodesExpanded || nodesExpanded < 1) return '—';
  return Math.pow(nodesExpanded, 1 / depth).toFixed(2);
}

const EMPTY_METRICS = { expanded: 0, frontier: 0, g: 0, h: 0, f: 0, bf: '—' };

const FACE_GROUPS = [
  {
    face: 'U',
    name: 'Up',
    turns: [
      { move: 'U', dir: 'CW 90°' },
      { move: "U'", dir: 'CCW 90°' },
      { move: 'U2', dir: '180°' },
    ],
  },
  {
    face: 'R',
    name: 'Right',
    turns: [
      { move: 'R', dir: 'CW 90°' },
      { move: "R'", dir: 'CCW 90°' },
      { move: 'R2', dir: '180°' },
    ],
  },
  {
    face: 'F',
    name: 'Front',
    turns: [
      { move: 'F', dir: 'CW 90°' },
      { move: "F'", dir: 'CCW 90°' },
      { move: 'F2', dir: '180°' },
    ],
  },
];

export function useCubeStudio() {
  const [settings, setSettings] = useState({
    algorithm: 'astar',
    heuristic: 'h2',
    mode: 'instant',
    speed: 1,
  });
  const [status, setStatus] = useState({ text: 'Engine ready.', kind: '' });
  const [engineState, setEngineState] = useState('Engine ready');
  const [tape, setTape] = useState([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [isSearching, setIsSearching] = useState(false);
  const [activeStep, setActiveStep] = useState(-1);
  const [solved, setSolved] = useState(true);
  const [cameraView, setCameraView] = useState('iso');
  const [copied, setCopied] = useState(false);

  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const treeRef = useRef(null);

  const modelRef = useRef(solvedState());
  const initialScrambleRef = useRef(solvedState());
  const recordedMovesRef = useRef([]);
  const tapeRef = useRef([]);
  const runTokenRef = useRef(0);
  const searchingRef = useRef(false);
  const settingsRef = useRef(settings);
  const inspectRef = useRef(() => {});

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    tapeRef.current = tape;
  }, [tape]);

  const pushStatus = useCallback((text, kind = '') => {
    setStatus({ text, kind });
    if (kind === 'solving') setEngineState('Searching…');
    else if (kind === 'solved') setEngineState('Target solved');
    else if (kind === 'error') setEngineState('Execution halted');
    else if (kind === 'scramble') setEngineState('Scrambled');
    else setEngineState(isSolved(modelRef.current) ? 'Solved state' : 'State modified');
  }, []);

  const moveDuration = useCallback(() => Math.max(35, 320 / settingsRef.current.speed), []);

  /* ── Scene mount ─────────────────────────────────────────── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const scene = new CubeScene(container);
    scene.setCameraView('iso');
    scene.syncToStateArray(modelRef.current);
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      if (sceneRef.current === scene) sceneRef.current = null;
    };
  }, []);

    /* ── Search-tree mount & dynamic ref ─────────────────────── */
  const cleanupTreeRef = useRef(null);

  const canvasRef = useCallback((canvas) => {
    if (cleanupTreeRef.current) {
      cleanupTreeRef.current();
      cleanupTreeRef.current = null;
    }
    if (!canvas) {
      treeRef.current = null;
      return;
    }
    const tree = new SearchTreeCanvas(canvas, {
      onNodeClick: (node) => inspectRef.current?.(node),
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
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupTreeRef.current) {
        cleanupTreeRef.current();
        cleanupTreeRef.current = null;
      }
    };
  }, []);

  /* ── Tape / preview helpers ──────────────────────────────── */
  const previewStep = useCallback(
    (index) => {
      if (searchingRef.current) return;
      const sequence = recordedMovesRef.current.slice(0, index + 1);
      const state = applyMoves(initialScrambleRef.current, sequence);
      sceneRef.current?.syncToStateArray(state);
      setActiveStep(index);
      pushStatus(
        `Inspecting step ${index + 1} of ${recordedMovesRef.current.length}: ${sequence[sequence.length - 1]}`
      );
    },
    [pushStatus]
  );

  const inspectNode = useCallback(
    (node) => {
      if (!node || !node.state) return;
      sceneRef.current?.syncToStateArray(node.state);
      pushStatus(
        `Node ${node.move || 'root'} · g=${node.g} h=${node.h} f=${node.f}`,
        'solving'
      );
    },
    [pushStatus]
  );
  useEffect(() => {
    inspectRef.current = inspectNode;
  }, [inspectNode]);

  /* ── Solution playback ───────────────────────────────────── */
  const playSolution = useCallback(
    async (result, token) => {
      const moves = result.solution || [];
      if (isSolved(modelRef.current) && moves.length === 0) {
        pushStatus('State is already solved!', 'solved');
        searchingRef.current = false;
        setIsSearching(false);
        return;
      }

      recordedMovesRef.current = [...moves];
      setTape(moves.map((move, index) => ({ move, index, kind: 'solution' })));
      pushStatus(`Solution found: ${moves.length} moves — playing animation…`, 'solving');

      for (let i = 0; i < moves.length; i++) {
        if (token !== runTokenRef.current) return;
        setActiveStep(i);
        await sceneRef.current?.queueMove(moves[i], moveDuration());
      }

      if (token !== runTokenRef.current) return;
      setActiveStep(moves.length);
      modelRef.current = solvedState();
      searchingRef.current = false;
      setIsSearching(false);
      setSolved(true);

      const bStar = computeBranchingFactor(result.nodesExpanded, result.solutionLength);
      setMetrics({
        expanded: result.nodesExpanded,
        frontier: 0,
        g: result.solutionLength ?? 0,
        h: 0,
        f: result.solutionLength ?? 0,
        bf: bStar,
      });
      pushStatus(
        `Optimal solution: ${result.solutionLength} move${result.solutionLength !== 1 ? 's' : ''}` +
          ` · ${result.nodesExpanded.toLocaleString()} evaluated · ${result.elapsedMs}ms · b*=${bStar}`,
        'solved'
      );
    },
    [moveDuration, pushStatus]
  );

  /* ── Solve ───────────────────────────────────────────────── */
  const solve = useCallback(async () => {
    if (searchingRef.current) return;
    const config = settingsRef.current;
    const token = ++runTokenRef.current;
    searchingRef.current = true;
    setIsSearching(true);
    setActiveStep(-1);
    treeRef.current?.reset();
    setMetrics(EMPTY_METRICS);

    const start = modelRef.current;
    // The solution tape replays from the state the search began at.
    initialScrambleRef.current = start;
    const started = performance.now();
    pushStatus(
      `Running ${ALGORITHM_LABELS[config.algorithm]} search with ${HEURISTICS[config.heuristic].label}…`,
      'solving'
    );

    const live = config.mode === 'live';
    const iterator = search(start, {
      algorithm: config.algorithm,
      heuristic: config.heuristic,
      maxNodes: UI_MAX_NODES,
      yieldEvery: 1,
    });

    let frameCount = 0;
    for (;;) {
      const { value, done } = iterator.next();
      if (token !== runTokenRef.current) {
        searchingRef.current = false;
        setIsSearching(false);
        return;
      }

      if (done) {
        const elapsed = Math.round(performance.now() - started);
        if (value.truncated || !value.solution) {
          pushStatus(`Node budget exhausted (${value.nodesExpanded.toLocaleString()} evaluated).`, 'error');
          searchingRef.current = false;
          setIsSearching(false);
          return;
        }
        value.elapsedMs = elapsed;
        treeRef.current?.markSolution();
        await playSolution(value, token);
        return;
      }

      treeRef.current?.addFrame(value);
      setMetrics({
        expanded: value.closedSetCount,
        frontier: value.openSetCount,
        g: value.currentNode.g,
        h: value.currentNode.h,
        f: value.currentNode.f,
        bf: computeBranchingFactor(value.closedSetCount, value.currentNode.g),
      });

      if (live) {
        sceneRef.current?.syncToStateArray(value.currentNode.state);
        await sleep(110 / settingsRef.current.speed);
      } else {
        frameCount += 1;
        if (frameCount % 25 === 0) await sleep(0);
      }
    }
  }, [playSolution, pushStatus]);

  const stop = useCallback(() => {
    runTokenRef.current += 1;
    searchingRef.current = false;
    setIsSearching(false);
    pushStatus('Search execution stopped.', 'error');
  }, [pushStatus]);

  /* ── Manual moves ────────────────────────────────────────── */
  const manualMove = useCallback(
    (move) => {
      runTokenRef.current += 1;
      searchingRef.current = false;
      setIsSearching(false);
      modelRef.current = applyMove(modelRef.current, move);
      sceneRef.current?.queueMove(move, moveDuration());
      recordedMovesRef.current.push(move);
      setTape((prev) => [...prev, { move, index: prev.length, kind: 'manual' }]);
      setSolved(isSolved(modelRef.current));
      pushStatus(`Applied ${move}`);
    },
    [moveDuration, pushStatus]
  );

  /* ── Reset / scramble / custom ───────────────────────────── */
  const reset = useCallback(() => {
    runTokenRef.current += 1;
    searchingRef.current = false;
    setIsSearching(false);
    modelRef.current = solvedState();
    initialScrambleRef.current = solvedState();
    recordedMovesRef.current = [];
    sceneRef.current?.syncToStateArray(modelRef.current);
    treeRef.current?.reset();
    setMetrics(EMPTY_METRICS);
    setTape([]);
    setActiveStep(-1);
    setSolved(true);
    pushStatus('Cube reset to solved state.');
  }, [pushStatus]);

  const scramble = useCallback(
    (depth) => {
      runTokenRef.current += 1;
      searchingRef.current = false;
      setIsSearching(false);
      const { state, scrambleMoves } = generateScramble(depth);
      modelRef.current = state;
      // A scramble tape replays from the solved state it started at.
      initialScrambleRef.current = solvedState();
      recordedMovesRef.current = [...scrambleMoves];
      sceneRef.current?.syncToStateArray(state);
      treeRef.current?.reset();
      setMetrics(EMPTY_METRICS);
      setTape(scrambleMoves.map((move, index) => ({ move, index, kind: 'scramble' })));
      setActiveStep(-1);
      setSolved(false);
      pushStatus(`Scrambled (${depth} turns): ${scrambleMoves.join(' ')}`, 'scramble');
    },
    [pushStatus]
  );

  /* Appends more turns to the existing scramble, keeping it one continuous,
   * non-redundant sequence. If the tape is not a scramble (empty, or a solved
   * solution), it starts a fresh scramble sequence from the current state. */
  const extendScramble = useCallback(
    (count) => {
      runTokenRef.current += 1;
      searchingRef.current = false;
      setIsSearching(false);

      const previous = tapeRef.current;
      const continues =
        previous.length > 0 && previous.every((entry) => entry.kind === 'scramble');
      if (!continues) {
        initialScrambleRef.current = modelRef.current;
        recordedMovesRef.current = [];
      }

      const lastMove = recordedMovesRef.current[recordedMovesRef.current.length - 1];
      const moves = randomMoves(count, lastMove ? lastMove[0] : null);

      sceneRef.current?.playMoves(moves, moveDuration());
      modelRef.current = applyMoves(modelRef.current, moves);
      recordedMovesRef.current = [...recordedMovesRef.current, ...moves];

      setTape((current) => {
        const base = continues ? current : [];
        return [
          ...base,
          ...moves.map((move, i) => ({ move, index: base.length + i, kind: 'scramble' })),
        ];
      });
      setActiveStep(-1);
      setSolved(false);
      treeRef.current?.reset();
      setMetrics(EMPTY_METRICS);
      pushStatus(`Added ${count} turns: ${moves.join(' ')}`, 'scramble');
    },
    [moveDuration, pushStatus]
  );

  const applyCustomMoves = useCallback(
    (text) => {
      const tokens = text.trim().split(/\s+/).filter(Boolean);
      const invalid = tokens.filter((token) => !/^[URF](2|')?$/.test(token));
      if (invalid.length > 0) {
        pushStatus(
          `Invalid: ${invalid.join(', ')} — use U, U', U2, R, R', R2, F, F', F2`,
          'error'
        );
        return false;
      }
      if (tokens.length === 0) return false;

      runTokenRef.current += 1;
      searchingRef.current = false;
      setIsSearching(false);
      initialScrambleRef.current = modelRef.current;
      modelRef.current = applyMoves(modelRef.current, tokens);
      sceneRef.current?.playMoves(tokens, moveDuration());
      recordedMovesRef.current = [...tokens];
      setTape(tokens.map((move, index) => ({ move, index, kind: 'scramble' })));
      setActiveStep(-1);
      setSolved(isSolved(modelRef.current));
      pushStatus(`Applied notation: ${tokens.join(' ')}`);
      return true;
    },
    [moveDuration, pushStatus]
  );

  /* ── Viewport / clipboard ────────────────────────────────── */
  const setView = useCallback((view) => {
    setCameraView(view);
    sceneRef.current?.setCameraView(view);
  }, []);

  const resetCamera = useCallback(() => {
    setCameraView('iso');
    sceneRef.current?.resetCamera();
  }, []);

  const syncScene = useCallback(() => {
    sceneRef.current?.syncToStateArray(modelRef.current);
  }, []);

  const copyTape = useCallback(async () => {
    if (recordedMovesRef.current.length === 0) return;
    const text = recordedMovesRef.current.join(' ');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      pushStatus(`Sequence: ${text}`);
    }
  }, [pushStatus]);

  const updateSetting = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  return {
    // refs to attach
    containerRef,
    canvasRef,
    sceneRef,
    // state
    settings,
    status,
    engineState,
    tape,
    metrics,
    isSearching,
    activeStep,
    solved,
    cameraView,
    copied,
    faceGroups: FACE_GROUPS,
    algorithms: ALGORITHMS,
    algorithmLabels: ALGORITHM_LABELS,
    heuristics: HEURISTICS,
    // actions
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
    syncScene,
    copyTape,
  };
}
