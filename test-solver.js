import assert from 'node:assert/strict';
import { search, runSearch, ALGORITHM_LABELS } from './src/solver/SearchEngine.js';
import { h0, h1, h2, cornerManhattanDistance } from './src/solver/heuristics.js';
import {
  solvedState,
  applyMoves,
  applyMove,
  isSolved,
  invertMoves,
  stateHash,
} from './src/core/CubeState.js';
import { MOVES } from './src/core/constants.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  PASS  ${name}`);
}

function assertReplaySolves(scrambledState, solution) {
  let state = scrambledState;
  for (const move of solution) state = applyMove(state, move);
  assert.equal(isSolved(state), true, `replay failed for [${solution.join(' ')}]`);
}

function assertValidFrame(frame, expectedAlgorithm) {
  assert.equal(typeof frame.step, 'number');
  assert.equal(frame.algorithm, expectedAlgorithm);
  const node = frame.currentNode;
  assert.equal(typeof node.id, 'string');
  assert.ok(node.id.length > 0);
  assert.ok(Array.isArray(node.path));
  assert.ok(node.path.every((m) => MOVES.includes(m)));
  assert.equal(Array.isArray(node.state), true);
  assert.equal(node.state.length, 24);
  assert.ok(node.state.every((c) => Number.isInteger(c) && c >= 0 && c <= 5));
  assert.equal(node.g, node.path.length, 'g must equal path length');
  assert.ok(Number.isFinite(node.h) && node.h >= 0);
  assert.equal(node.f, node.g + node.h, 'f must equal g + h');
  assert.ok(Number.isInteger(frame.openSetCount) && frame.openSetCount >= 0);
  assert.ok(Number.isInteger(frame.closedSetCount) && frame.closedSetCount >= 0);
  assert.ok(Array.isArray(frame.openTopNodes));
  assert.ok(frame.openTopNodes.length <= 5);
  for (const top of frame.openTopNodes) {
    assert.equal(top.f, top.g + top.h);
    assert.ok(MOVES.includes(top.move) || top.move === null);
  }
  assert.equal(typeof frame.isGoal, 'boolean');
}

console.log('Verification Gate 2 — Heuristic Search & Soft Computing Engine');

check('heuristics are zero on the solved state and non-negative elsewhere', () => {
  const solved = solvedState();
  assert.equal(h1(solved), 0);
  assert.equal(h2(solved), 0);
  assert.equal(h0(solved), 0);
  const scrambled = applyMoves(solvedState(), ['R', 'U', "F'", 'U2']);
  for (const h of [h0, h1, h2]) {
    assert.ok(h(scrambled) >= 0);
  }
});

check('h1 and h2 are admissible (h <= true depth) on all states within 3 moves', () => {
  const visited = new Map([[stateHash(solvedState()), 0]]);
  let frontier = [solvedState()];
  for (let depth = 1; depth <= 3; depth++) {
    const next = [];
    for (const state of frontier) {
      for (const move of MOVES) {
        const child = applyMove(state, move);
        const id = stateHash(child);
        if (visited.has(id)) continue;
        visited.set(id, depth);
        next.push(child);
      }
    }
    frontier = next;
  }
  for (const [id, depth] of visited) {
    const state = id.split(',').map(Number);
    assert.ok(h1(state) <= depth + 1e-9, `h1=${h1(state)} > depth ${depth}`);
    assert.ok(h2(state) <= depth + 1e-9, `h2=${h2(state)} > depth ${depth}`);
    assert.ok(cornerManhattanDistance(state) <= 4 * depth);
  }
});

const SCRAMBLES = [
  ['R', 'U', "F'", 'U2', "R'", 'F'],
  ['U2', 'F', 'R', "U'", 'F2', 'R'],
  ['F', "U'", 'R2', 'U', 'F', "R'"],
];

check('A* with h2 solves a 6-move scramble in <= 6 moves and under 500ms', () => {
  for (const moves of SCRAMBLES) {
    const scrambled = applyMoves(solvedState(), moves);
    const started = performance.now();
    const { result } = runSearch(scrambled, {
      algorithm: 'astar',
      heuristic: 'h2',
      collectFrames: false,
    });
    const elapsed = performance.now() - started;
    assert.ok(result.solution, `A* found no solution for [${moves.join(' ')}]`);
    assert.ok(result.solution.length <= 6, `solution too long: ${result.solution.length}`);
    assertReplaySolves(scrambled, result.solution);
    assert.ok(elapsed < 500, `A* took ${elapsed.toFixed(1)}ms for [${moves.join(' ')}]`);
    console.log(
      `        A* h2 [${moves.join(' ')}] -> ${result.solution.join(' ')}` +
        ` (${result.solution.length} moves, ${result.nodesExpanded} nodes, ${elapsed.toFixed(1)}ms)`
    );
  }
});

check('A* is optimal on a known 2-move scramble', () => {
  const scrambled = applyMoves(solvedState(), ['U', 'R']);
  const { result } = runSearch(scrambled, { algorithm: 'astar', heuristic: 'h2', collectFrames: false });
  assert.equal(result.solution.length, 2);
  assertReplaySolves(scrambled, result.solution);
});

check('IDA* solves every 6-move scramble within 6 moves and replays to solved', () => {
  for (const moves of SCRAMBLES) {
    const scrambled = applyMoves(solvedState(), moves);
    const started = performance.now();
    const { result } = runSearch(scrambled, {
      algorithm: 'ida',
      heuristic: 'h2',
      collectFrames: false,
      yieldEvery: 1000,
    });
    const elapsed = performance.now() - started;
    assert.ok(result.solution, `IDA* found no solution for [${moves.join(' ')}]`);
    assert.ok(result.solution.length <= 6, `IDA* solution too long: ${result.solution.length}`);
    assertReplaySolves(scrambled, result.solution);
    console.log(
      `        IDA* h2 [${moves.join(' ')}] -> ${result.solution.join(' ')}` +
        ` (${result.solution.length} moves, ${result.nodesExpanded} nodes, ${elapsed.toFixed(1)}ms)`
    );
  }
});

check('Greedy Best-First solves a 6-move scramble and replays to solved', () => {
  for (const moves of SCRAMBLES) {
    const scrambled = applyMoves(solvedState(), moves);
    const started = performance.now();
    const { result } = runSearch(scrambled, {
      algorithm: 'greedy',
      heuristic: 'h2',
      maxNodes: 500_000,
      collectFrames: false,
      yieldEvery: 1000,
    });
    const elapsed = performance.now() - started;
    assert.ok(result.solution && !result.truncated, `Greedy failed for [${moves.join(' ')}]`);
    assert.ok(result.solution.length <= 150, `greedy path too long: ${result.solution.length}`);
    assertReplaySolves(scrambled, result.solution);
    console.log(
      `        Greedy h2 [${moves.join(' ')}] -> ${result.solution.join(' ')}` +
        ` (${result.solution.length} moves, ${result.nodesExpanded} nodes, ${elapsed.toFixed(1)}ms)`
    );
  }
});

check('all algorithms emit valid telemetry frames (contract 1.2)', () => {
  const scrambled = applyMoves(solvedState(), ['U', 'R', 'F']);
  for (const [algorithmId, label] of Object.entries(ALGORITHM_LABELS)) {
    const iterator = search(scrambled, { algorithm: algorithmId, heuristic: 'h1', yieldEvery: 1 });
    let frames = 0;
    let lastStep = -1;
    for (;;) {
      const { value, done } = iterator.next();
      if (done) {
        assert.ok(value.solution, `${algorithmId} returned no solution`);
        assertReplaySolves(scrambled, value.solution);
        break;
      }
      assertValidFrame(value, label);
      assert.ok(value.step > lastStep, 'frame step must increase monotonically');
      lastStep = value.step;
      frames++;
      assert.ok(frames < 100_000, 'runaway generator');
    }
    assert.ok(frames > 0, `${algorithmId} emitted no frames`);
    console.log(`        ${label}: ${frames} valid telemetry frames`);
  }
});

check('generator is step-drivable: N next() calls yield exactly N frames', () => {
  const scrambled = applyMoves(solvedState(), ['U2', 'F']);
  const iterator = search(scrambled, { algorithm: 'astar', heuristic: 'h1', yieldEvery: 1 });
  for (let i = 0; i < 5; i++) {
    const { value, done } = iterator.next();
    assert.equal(done, false);
    assertValidFrame(value, 'A*');
    assert.equal(value.step, i);
  }
});

check('search on an already-solved state yields an immediate goal frame', () => {
  const { result, frames } = runSearch(solvedState(), { algorithm: 'astar', heuristic: 'h2' });
  assert.equal(frames.length, 1);
  assert.equal(frames[0].isGoal, true);
  assert.deepEqual(result.solution, []);
});

check('inverse of a returned solution restores the scramble (round-trip)', () => {
  const scrambled = applyMoves(solvedState(), ['F', 'R', "U'", 'F']);
  const { result } = runSearch(scrambled, { algorithm: 'astar', heuristic: 'h1', collectFrames: false });
  const restored = applyMoves(scrambled, result.solution);
  assert.equal(isSolved(restored), true);
  const roundTrip = applyMoves(restored, invertMoves(result.solution));
  assert.equal(stateHash(roundTrip), stateHash(scrambled));
});

console.log(`\nGate 2 passed: ${passed} checks.`);
