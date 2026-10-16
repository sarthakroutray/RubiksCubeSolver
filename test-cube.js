import assert from 'node:assert/strict';
import {
  solvedState,
  isSolved,
  applyMove,
  applyMoves,
  invertMoves,
  scramble,
  stateHash,
  MOVE_PERMUTATIONS,
} from './src/core/CubeState.js';
import {
  SOLVED_STATE,
  MOVES,
  CORNER_STICKERS,
  CORNER_NAMES,
  FACE_ID,
  FIXED_CORNER_INDEX,
} from './src/core/constants.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  PASS  ${name}`);
}

console.log('Verification Gate 1 — Core Cube State & Permutation Engine');

check('corner sticker indices sit on the faces named by each corner', () => {
  CORNER_STICKERS.forEach((slots, i) => {
    const faces = slots.map((s) => s >> 2).sort().join('');
    const named = CORNER_NAMES[i]
      .split('')
      .map((letter) => FACE_ID[letter])
      .sort()
      .join('');
    assert.equal(faces, named, `corner ${CORNER_NAMES[i]}: slots ${slots} -> faces ${faces}`);
    assert.equal(new Set(slots).size, 3);
  });
});

check('every move permutation is a bijection over the 24 sticker slots', () => {
  for (const move of MOVES) {
    const perm = MOVE_PERMUTATIONS[move];
    assert.equal(new Set(perm).size, 24, `move ${move} is not a bijection`);
  }
});

check('the fixed DBL corner stickers never move under any move', () => {
  const fixedSlots = CORNER_STICKERS[FIXED_CORNER_INDEX];
  for (const move of MOVES) {
    const next = applyMove(solvedState(), move);
    for (const slot of fixedSlots) assert.equal(next[slot], SOLVED_STATE[slot], `${move} disturbed ${slot}`);
  }
});

check('all moves preserve the sticker color multiset', () => {
  const counts = (state) => state.reduce((acc, c) => ((acc[c] = (acc[c] || 0) + 1), acc), {});
  const base = counts(solvedState());
  for (const move of MOVES) {
    assert.deepEqual(counts(applyMove(solvedState(), move)), base);
  }
});

check('applying U four times returns the solved state', () => {
  let state = solvedState();
  for (let i = 0; i < 4; i++) state = applyMove(state, 'U');
  assert.equal(isSolved(state), true, `U x4 != solved: ${stateHash(state)}`);
});

check('applying the sexy move (R U R\' U\') six times returns the solved state', () => {
  let state = solvedState();
  for (let i = 0; i < 6; i++) state = applyMoves(state, ['R', 'U', "R'", "U'"]);
  assert.equal(isSolved(state), true, `(R U R' U') x6 != solved: ${stateHash(state)}`);
});

check('any move followed by its inverse is the identity', () => {
  for (const move of MOVES) {
    const [inverse] = invertMoves([move]);
    assert.equal(isSolved(applyMoves(solvedState(), [move, inverse])), true, `${move} ${inverse}`);
  }
});

check('a 10-move sequence followed by its exact inverse sequence is solved', () => {
  const sequence = ['U', "R'", 'F2', 'U2', 'R', 'F', "U'", 'R2', 'F', 'U2'];
  const scrambled = applyMoves(solvedState(), sequence);
  assert.equal(isSolved(scrambled), false, 'scramble was trivial');
  const restored = applyMoves(scrambled, invertMoves(sequence));
  assert.equal(isSolved(restored), true, `inverse failed: ${stateHash(restored)}`);
});

check('scramble(depth) returns non-redundant moves that reproduce the returned state', () => {
  for (const depth of [5, 7, 12]) {
    const { state, scrambleMoves } = scramble(depth);
    assert.equal(scrambleMoves.length, depth);
    for (let i = 1; i < scrambleMoves.length; i++) {
      assert.notEqual(scrambleMoves[i][0], scrambleMoves[i - 1][0], 'same face twice in a row');
    }
    assert.equal(stateHash(applyMoves(solvedState(), scrambleMoves)), stateHash(state));
  }
});

check('double moves and quarter turns stay consistent (U2 U2 = identity, U U2 U = identity)', () => {
  assert.equal(isSolved(applyMoves(solvedState(), ['U2', 'U2'])), true);
  assert.equal(isSolved(applyMoves(solvedState(), ['U', 'U2', 'U'])), true);
  assert.equal(isSolved(applyMoves(solvedState(), ['R2', 'R2'])), true);
  assert.equal(isSolved(applyMoves(solvedState(), ['F2', 'F2'])), true);
});

console.log(`\nGate 1 passed: ${passed} checks.`);
