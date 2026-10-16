import './styles/main.css';
import { CubeScene } from './three/CubeScene.js';
import { SearchTreeCanvas } from './visualizer/SearchTreeCanvas.js';
import { MetricsDashboard, computeBranchingFactor } from './visualizer/MetricsDashboard.js';
import { search, ALGORITHM_LABELS } from './solver/SearchEngine.js';
import { HEURISTICS } from './solver/heuristics.js';
import { solvedState, applyMove, applyMoves, scramble, isSolved } from './core/CubeState.js';

const els = {
  viewport:       document.getElementById('cube-viewport'),
  manualMoves:    document.getElementById('manual-moves'),
  tape:           document.getElementById('move-tape'),
  tapeCounter:    document.getElementById('tape-counter'),
  copyTape:       document.getElementById('copy-tape-btn'),
  algorithm:      document.getElementById('algorithm'),
  heuristic:      document.getElementById('heuristic'),
  mode:           document.getElementById('mode'),
  speed:          document.getElementById('speed'),
  speedLabel:     document.getElementById('speed-label'),
  customMoves:    document.getElementById('custom-moves'),
  applyCustom:    document.getElementById('apply-custom'),
  solve:          document.getElementById('solve'),
  stop:           document.getElementById('stop'),
  status:         document.getElementById('status'),
  metrics:        document.getElementById('metrics'),
  treeCanvas:     document.getElementById('tree-canvas'),
  resetCube:      document.getElementById('reset-cube-btn'),
  enginePulse:    document.getElementById('engine-pulse'),
  engineState:    document.getElementById('engine-state'),
  treePulse:      document.getElementById('tree-pulse'),
  shortcutsModal: document.getElementById('shortcuts-modal'),
  openShortcuts:  document.getElementById('open-shortcuts-btn'),
  closeShortcuts: document.getElementById('close-shortcuts-btn'),
  hudResetCam:    document.getElementById('hud-reset-cam'),
};

const cube = new CubeScene(els.viewport);
const tree = new SearchTreeCanvas(els.treeCanvas, {
  onNodeClick: (node) => {
    if (!node.state) return;
    cube.syncToStateArray(node.state);
    setStatus(`Node ${node.move || 'root'} · g=${node.g} h=${node.h} f=${node.f}`, 'solving');
  },
});
const metrics = new MetricsDashboard(els.metrics);

let model = solvedState();
let runToken = 0;
let isSearching = false;
let recordedMoves = [];
let initialScrambleState = solvedState();
const UI_MAX_NODES = 1_000_000;

/* ─── Status & Engine Activity ─────────────────────────────────── */
function setStatus(text, kind = '') {
  els.status.textContent = text;
  els.status.className = 'status-pill' + (kind ? ` ${kind}` : '');

  if (kind === 'solving') {
    els.enginePulse.className = 'pulse-indicator active';
    els.treePulse.className = 'tree-title-dot active';
    els.engineState.textContent = 'Searching…';
  } else if (kind === 'solved') {
    els.enginePulse.className = 'pulse-indicator';
    els.treePulse.className = 'tree-title-dot';
    els.engineState.textContent = 'Target Solved';
  } else if (kind === 'error') {
    els.enginePulse.className = 'pulse-indicator stopped';
    els.treePulse.className = 'tree-title-dot';
    els.engineState.textContent = 'Execution Halted';
  } else {
    els.enginePulse.className = 'pulse-indicator';
    els.treePulse.className = 'tree-title-dot';
    els.engineState.textContent = isSolved(model) ? 'Solved State' : 'State Modified';
  }
}

/* ─── Playback Speed ─────────────────────────────────────────── */
function currentSpeed() {
  return Number.parseFloat(els.speed.value);
}

function moveDuration() {
  return Math.max(35, 320 / currentSpeed());
}

function updateSpeedUI() {
  const v = currentSpeed();
  els.speedLabel.textContent = `${v.toFixed(2).replace(/\.?0+$/, '')}×`;
  const pct = ((v - 0.25) / (10 - 0.25)) * 100;
  els.speed.style.setProperty('--pct', `${pct}%`);
  els.speed.style.background = `linear-gradient(to right, var(--blue) 0%, var(--blue) ${pct}%, rgba(255, 255, 255, 0.08) ${pct}%)`;

  for (const btn of document.querySelectorAll('.speed-preset-btn')) {
    const val = Number.parseFloat(btn.dataset.speed);
    btn.classList.toggle('active', Math.abs(val - v) < 0.05);
  }
}

/* ─── Move Tape ──────────────────────────────────────────────── */
function updateTapeCounter(count = recordedMoves.length) {
  els.tapeCounter.textContent = `${count} move${count !== 1 ? 's' : ''}`;
}

function setTape(entries) {
  recordedMoves = entries.map((e) => e.move);
  updateTapeCounter(recordedMoves.length);

  if (entries.length === 0) {
    els.tape.innerHTML = '<span class="tape-placeholder">No moves recorded — scramble or apply manual turns</span>';
    return;
  }

  els.tape.innerHTML = entries
    .map(
      (entry) =>
        `<span class="tape-chip ${entry.kind || ''}" data-index="${entry.index}" title="Click to inspect state">${entry.move}</span>`
    )
    .join('');

  for (const chip of els.tape.querySelectorAll('.tape-chip')) {
    chip.addEventListener('click', () => {
      const idx = Number(chip.dataset.index);
      previewStateAtMove(idx);
    });
  }
}

function highlightTape(index) {
  const chips = els.tape.querySelectorAll('.tape-chip');
  chips.forEach((chip) => {
    const chipIndex = Number(chip.dataset.index);
    chip.classList.toggle('active', chipIndex === index);
    chip.classList.toggle('done', chipIndex < index);
  });

  const activeChip = els.tape.querySelector(`.tape-chip[data-index="${index}"]`);
  if (activeChip) {
    activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function previewStateAtMove(targetIndex) {
  if (isSearching) return;
  const sequence = recordedMoves.slice(0, targetIndex + 1);
  const previewState = applyMoves(initialScrambleState, sequence);
  cube.syncToStateArray(previewState);
  highlightTape(targetIndex);
  setStatus(`Inspecting step ${targetIndex + 1} of ${recordedMoves.length}: ${sequence[sequence.length - 1]}`);
}

function solutionTape(moves) {
  setTape(moves.map((move, index) => ({ move, index, kind: 'solution' })));
}

async function copyMoveTape() {
  if (recordedMoves.length === 0) return;
  const text = recordedMoves.join(' ');
  try {
    await navigator.clipboard.writeText(text);
    const origText = els.copyTape.innerHTML;
    els.copyTape.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
      <span>Copied!</span>`;
    setTimeout(() => {
      els.copyTape.innerHTML = origText;
    }, 1400);
  } catch {
    setStatus(`Sequence: ${text}`);
  }
}

/* ─── Manual Moves ───────────────────────────────────────────── */
function manualMove(move) {
  runToken++;
  isSearching = false;
  model = applyMove(model, move);
  cube.queueMove(move, moveDuration());
  recordedMoves.push(move);
  updateTapeCounter();

  const ph = els.tape.querySelector('.tape-placeholder');
  if (ph) ph.remove();

  const chip = document.createElement('span');
  chip.className = 'tape-chip';
  chip.dataset.index = recordedMoves.length - 1;
  chip.textContent = move;
  chip.addEventListener('click', () => previewStateAtMove(recordedMoves.length - 1));
  els.tape.appendChild(chip);
  chip.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });

  setStatus(`Applied ${move}`);
}

/* ─── Reset Cube to Solved ────────────────────────────────────── */
function resetToSolved() {
  runToken++;
  isSearching = false;
  model = solvedState();
  initialScrambleState = solvedState();
  recordedMoves = [];
  cube.syncToStateArray(model);
  tree.reset();
  metrics.reset();
  setTape([]);
  setStatus('Cube reset to solved state.');
}

/* ─── Scramble ───────────────────────────────────────────────── */
function doScramble(depth) {
  runToken++;
  isSearching = false;
  const { state, scrambleMoves } = scramble(depth);
  model = state;
  initialScrambleState = state;
  cube.syncToStateArray(model);
  tree.reset();
  metrics.reset();
  setTape(scrambleMoves.map((move, index) => ({ move, index, kind: 'scramble' })));
  setStatus(`Scrambled (${depth} turns): ${scrambleMoves.join(' ')}`);
}

/* ─── Custom Moves ───────────────────────────────────────────── */
function doCustomMoves() {
  const tokens = els.customMoves.value.trim().split(/\s+/).filter(Boolean);
  const invalid = tokens.filter((t) => !/^[URF](2|')?$/.test(t));
  if (invalid.length > 0) {
    setStatus(`Invalid: ${invalid.join(', ')} — use standard notation: U, U', U2, R, R', R2, F, F', F2`, 'error');
    return;
  }
  if (tokens.length === 0) return;

  runToken++;
  isSearching = false;
  initialScrambleState = model;
  model = applyMoves(model, tokens);
  cube.playMoves(tokens, moveDuration());
  setTape(tokens.map((move, index) => ({ move, index, kind: 'scramble' })));
  setStatus(`Applied notation: ${tokens.join(' ')}`);
}

/* ─── Sleep helper ───────────────────────────────────────────── */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ─── Play Solution ──────────────────────────────────────────── */
async function playSolution(result, token) {
  const moves = result.solution || [];
  if (isSolved(model) && moves.length === 0) {
    setStatus('State is already solved!', 'solved');
    isSearching = false;
    return;
  }
  solutionTape(moves);
  setStatus(`Solution found: ${moves.length} moves — playing animation…`, 'solving');

  for (let i = 0; i < moves.length; i++) {
    if (token !== runToken) return;
    highlightTape(i);
    await cube.queueMove(moves[i], moveDuration());
  }

  if (token !== runToken) return;
  highlightTape(moves.length);
  model = solvedState();
  isSearching = false;

  const bStar = computeBranchingFactor(result.nodesExpanded, result.solutionLength);
  metrics.updateFromResult(result);
  metrics.cards.bf.textContent = bStar;

  setStatus(
    `Optimal solution: ${result.solutionLength} move${result.solutionLength !== 1 ? 's' : ''} · ${result.nodesExpanded.toLocaleString()} evaluated · ${result.elapsedMs}ms · b*=${bStar}`,
    'solved'
  );
}

/* ─── Solve ──────────────────────────────────────────────────── */
async function doSolve() {
  if (isSearching) return;
  const token = ++runToken;
  isSearching = true;
  tree.reset();
  metrics.reset();

  const algorithm = els.algorithm.value;
  const heuristic = els.heuristic.value;
  const live      = els.mode.value === 'live';
  const start     = model;
  const started   = performance.now();

  setStatus(
    `Running ${ALGORITHM_LABELS[algorithm]} search with ${HEURISTICS[heuristic].label}…`,
    'solving'
  );

  const iterator = search(start, {
    algorithm,
    heuristic,
    maxNodes: UI_MAX_NODES,
    yieldEvery: live ? 1 : 20,
  });

  let frameCount = 0;
  for (;;) {
    const { value, done } = iterator.next();
    if (token !== runToken) {
      isSearching = false;
      return;
    }

    if (done) {
      const elapsed = Math.round(performance.now() - started);
      if (value.truncated || !value.solution) {
        setStatus(`Node budget exhausted (${value.nodesExpanded.toLocaleString()} evaluated).`, 'error');
        isSearching = false;
        return;
      }
      value.elapsedMs = elapsed;
      await playSolution(value, token);
      return;
    }

    tree.addFrame(value);
    metrics.update(value, {
      branchingFactor: computeBranchingFactor(value.closedSetCount, value.currentNode.g),
    });

    if (live) {
      cube.syncToStateArray(value.currentNode.state);
      await sleep(110 / currentSpeed());
    } else {
      frameCount++;
      if (frameCount % 250 === 0) await sleep(0);
    }
  }
}

/* ─── Stop ───────────────────────────────────────────────────── */
function stopRun() {
  runToken++;
  isSearching = false;
  setStatus('Search execution stopped.', 'error');
}

/* ─── Build Structured Manual Move Buttons ──────────────────── */
const FACE_GROUPS = [
  {
    name: 'Up (U)',
    turns: [
      { move: 'U', dir: '↷ 90°' },
      { move: "U'", dir: '↶ 90°' },
      { move: 'U2', dir: '⟲ 180°' },
    ],
  },
  {
    name: 'Right (R)',
    turns: [
      { move: 'R', dir: '↷ 90°' },
      { move: "R'", dir: '↶ 90°' },
      { move: 'R2', dir: '⟲ 180°' },
    ],
  },
  {
    name: 'Front (F)',
    turns: [
      { move: 'F', dir: '↷ 90°' },
      { move: "F'", dir: '↶ 90°' },
      { move: 'F2', dir: '⟲ 180°' },
    ],
  },
];

for (const group of FACE_GROUPS) {
  const groupEl = document.createElement('div');
  groupEl.className = 'face-group';

  const labelEl = document.createElement('span');
  labelEl.className = 'face-group-label';
  labelEl.textContent = group.name;
  groupEl.appendChild(labelEl);

  const btnsEl = document.createElement('div');
  btnsEl.className = 'face-group-btns';

  for (const { move, dir } of group.turns) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'move-btn';
    btn.innerHTML = `<span>${move}</span><span class="move-btn-dir">${dir}</span>`;
    btn.addEventListener('click', () => manualMove(move));
    btnsEl.appendChild(btn);
  }

  groupEl.appendChild(btnsEl);
  els.manualMoves.appendChild(groupEl);
}

/* ─── Viewport Studio HUD ────────────────────────────────────── */
for (const btn of document.querySelectorAll('.hud-btn[data-view]')) {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.hud-btn[data-view]').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    cube.setCameraView(btn.dataset.view);
  });
}

els.hudResetCam.addEventListener('click', () => {
  document.querySelectorAll('.hud-btn[data-view]').forEach((b) => b.classList.remove('active'));
  const isoBtn = document.querySelector('.hud-btn[data-view="iso"]');
  if (isoBtn) isoBtn.classList.add('active');
  cube.resetCamera();
});

/* ─── Speed Presets ──────────────────────────────────────────── */
for (const btn of document.querySelectorAll('.speed-preset-btn')) {
  btn.addEventListener('click', () => {
    els.speed.value = btn.dataset.speed;
    updateSpeedUI();
  });
}

/* ─── Scramble Buttons ───────────────────────────────────────── */
for (const button of document.querySelectorAll('[data-scramble]')) {
  button.addEventListener('click', () => doScramble(Number(button.dataset.scramble)));
}

/* ─── Shortcuts Modal ────────────────────────────────────────── */
function toggleShortcutsModal(open) {
  const isOpen = open !== undefined ? open : !els.shortcutsModal.classList.contains('open');
  els.shortcutsModal.classList.toggle('open', isOpen);
  els.shortcutsModal.setAttribute('aria-hidden', String(!isOpen));
}

els.openShortcuts.addEventListener('click', () => toggleShortcutsModal(true));
els.closeShortcuts.addEventListener('click', () => toggleShortcutsModal(false));
els.shortcutsModal.addEventListener('click', (e) => {
  if (e.target === els.shortcutsModal) toggleShortcutsModal(false);
});

/* ─── Global Keyboard Shortcuts ──────────────────────────────── */
window.addEventListener('keydown', (e) => {
  // If user is typing in custom moves input, don't trigger global shortcuts
  if (document.activeElement === els.customMoves) {
    if (e.key === 'Escape') els.customMoves.blur();
    return;
  }

  // Toggle shortcuts modal on '?'
  if (e.key === '?') {
    e.preventDefault();
    toggleShortcutsModal();
    return;
  }

  // Close modal or stop on Escape
  if (e.key === 'Escape') {
    if (els.shortcutsModal.classList.contains('open')) {
      toggleShortcutsModal(false);
      return;
    }
    stopRun();
    return;
  }

  // Spacebar to run solve / stop
  if (e.code === 'Space') {
    e.preventDefault();
    if (isSearching) stopRun();
    else doSolve();
    return;
  }

  // 'S' for quick scramble
  if (e.key === 's' || e.key === 'S') {
    if (!e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      doScramble(7);
      return;
    }
  }

  // 'R' for reset cube (unless Alt+R for R face move)
  if ((e.key === 'r' || e.key === 'R') && !e.altKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    resetToSolved();
    return;
  }

  // Face keys: U, F, Alt+R
  if (e.key === 'u' || e.key === 'U') {
    e.preventDefault();
    manualMove(e.shiftKey ? "U'" : 'U');
    return;
  }
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    manualMove(e.shiftKey ? "F'" : 'F');
    return;
  }
  if (e.altKey && (e.key === 'r' || e.key === 'R')) {
    e.preventDefault();
    manualMove(e.shiftKey ? "R'" : 'R');
    return;
  }
});

/* ─── Actions & Inputs ───────────────────────────────────────── */
els.applyCustom.addEventListener('click', doCustomMoves);
els.customMoves.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doCustomMoves();
});

els.solve.addEventListener('click', doSolve);
els.stop.addEventListener('click', stopRun);
els.resetCube.addEventListener('click', resetToSolved);
els.copyTape.addEventListener('click', copyMoveTape);

els.speed.addEventListener('input', updateSpeedUI);
window.addEventListener('resize', () => tree.resize());

/* ─── Initialization ─────────────────────────────────────────── */
updateSpeedUI();
setStatus('Engine ready.');
