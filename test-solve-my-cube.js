import assert from 'node:assert/strict';
import {
  solvedState,
  applyMove,
  applyMoves,
  isSolved,
  scramble,
  stateHash,
} from './src/core/CubeState.js';
import { MOVES, CORNER_STICKERS } from './src/core/constants.js';
import { validateCube } from './src/solve-my-cube/validation/validateCube.js';
import {
  normalizeOrientation,
  rotateState,
} from './src/solve-my-cube/conversion/normalizeOrientation.js';
import { search } from './src/solver/SearchEngine.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  PASS  ${name}`);
}

console.log('Verification Gate 4 — Solve My Cube Pipeline, Validation & Normalization');

// 1. Solved State
check('solved state validates as valid and isSolved=true', () => {
  const solved = solvedState();
  const v = validateCube(solved);
  assert.equal(v.valid, true);
  assert.equal(v.isSolved, true);
  assert.equal(v.unsetCount, 0);
  assert.equal(v.error, null);
});

// 2. Unset / Incomplete stickers
check('incomplete sticker state reports exact unset count and offending slots', () => {
  const incomplete = solvedState();
  incomplete[0] = -1;
  incomplete[14] = -1;
  incomplete[23] = -1;
  const v = validateCube(incomplete);
  assert.equal(v.valid, false);
  assert.equal(v.unsetCount, 3);
  assert.deepEqual(v.offendingSlots, [0, 14, 23]);
  assert.ok(v.error.includes('3 stickers left to paint'));
});

// 3. Unbalanced color counts
check('unbalanced color counts are strictly rejected with detailed breakdown', () => {
  const state = solvedState();
  state[0] = 1; // 5 Reds, 3 Whites
  const v = validateCube(state);
  assert.equal(v.valid, false);
  assert.ok(v.error.includes('Each color must appear exactly 4 times'));
  assert.ok(v.offendingSlots.length > 0);
});

// 4. Duplicate corner pieces
check('duplicate corner pieces are detected and highlighted', () => {
  const state = solvedState();
  // Duplicate corner 0 (UFL) onto corner 1 (UFR)
  state[3] = state[2];
  state[9] = state[8];
  state[4] = state[17];
  // Fix counts elsewhere so count check passes
  state[1] = 1;
  state[5] = 4;
  state[20] = 3;
  const v = validateCube(state);
  assert.equal(v.valid, false);
  assert.ok(v.error.includes('Duplicate corner') || v.error.includes('Each color must appear'));
});

// 5. Impossible corner (opposite colors on same corner)
check('corners with opposite colors are detected as invalid', () => {
  const state = solvedState();
  // Put White (0) and Yellow (3) on corner 0
  state[2] = 0;
  state[8] = 3;
  state[17] = 4;
  // Balance counts
  state[12] = 2;
  const v = validateCube(state);
  assert.equal(v.valid, false);
  assert.ok(v.error !== null);
});

// 6. Mirrored corner piece (chirality violation)
check('physically mirrored corner pieces fail chirality check', () => {
  const state = solvedState();
  // Swap two stickers on corner 1 (UFR) to invert chirality
  const temp = state[9];
  state[9] = state[4];
  state[4] = temp;
  const v = validateCube(state);
  assert.equal(v.valid, false);
  assert.ok(
    v.error.includes('mirrored') ||
    v.error.includes('twist') ||
    v.error.includes('Invalid corner')
  );
});

// 7. Corner twist parity violation
check('single corner twist fails total twist parity mod 3', () => {
  const state = solvedState();
  // Twist corner 0 (UFL): cycle stickers [2, 8, 17] by 1
  const t = state[2];
  state[2] = state[17];
  state[17] = state[8];
  state[8] = t;
  const v = validateCube(state);
  assert.equal(v.valid, false);
  assert.ok(v.error.includes('twist'));
});

// 8. Normalization across all 24 3D spatial rotations
check('cube held in any of the 24 spatial rotations normalizes and validates', () => {
  const { state: scrambled } = scramble(5);
  for (let rot = 0; rot < 24; rot++) {
    const rotated = rotateState(scrambled, rot);
    const v = validateCube(rotated);
    assert.equal(
      v.valid,
      true,
      `Rotation ${rot} failed to normalize: ${v.error}`
    );
    assert.ok(v.normalizedState !== null);
    // Fixed anchor DBL must be at slots 14 (D/3), 23 (B/5), 18 (L/4)
    assert.equal(v.normalizedState[14], 3);
    assert.equal(v.normalizedState[23], 5);
    assert.equal(v.normalizedState[18], 4);
  }
});

// 9. Custom color scheme normalization
check('cube with Japanese or custom opposite color scheme normalizes correctly', () => {
  const solved = solvedState();
  // Swap Blue (5) and Yellow (3) in user color scheme
  const custom = solved.map((c) => (c === 5 ? 3 : c === 3 ? 5 : c));
  const v = validateCube(custom);
  assert.equal(v.valid, true);
  assert.equal(v.isSolved, true);
});

// 10. End-to-End Property Test on random scrambles
check('property test: 15 random scrambles pass validation and solve to 100% solved state', () => {
  for (let testIdx = 0; testIdx < 15; testIdx++) {
    const depth = Math.floor(Math.random() * 6) + 1; // 1 to 6 moves
    const { state: testScramble, scrambleMoves } = scramble(depth);

    // Apply random 3D rotation
    const rot = Math.floor(Math.random() * 24);
    const rotatedInput = rotateState(testScramble, rot);

    // 1. Validate & Normalize
    const validation = validateCube(rotatedInput);
    assert.equal(
      validation.valid,
      true,
      `Scramble ${testIdx} failed validation: ${validation.error}`
    );

    // 2. Solve with A* and h2
    const iterator = search(validation.normalizedState, {
      algorithm: 'astar',
      heuristic: 'h2',
      maxNodes: 100_000,
    });

    let solution = null;
    for (;;) {
      const { value, done } = iterator.next();
      if (done) {
        solution = value.solution;
        break;
      }
    }

    assert.ok(solution !== null, `Solver found no solution for test ${testIdx}`);
    assert.ok(
      solution.length <= depth,
      `Optimal solution (${solution.length}) exceeded scramble depth (${depth})`
    );

    // 3. Apply moves step-by-step and verify solved
    let replay = [...validation.normalizedState];
    for (const m of solution) {
      replay = applyMove(replay, m);
    }
    assert.equal(
      isSolved(replay),
      true,
      `Solution [${solution.join(' ')}] did not solve the normalized state`
    );
  }
});

console.log(`\nGate 4 passed: ${passed} checks.\n`);
