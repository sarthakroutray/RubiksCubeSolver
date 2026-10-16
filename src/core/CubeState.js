import {
  SOLVED_STATE,
  BASE_MOVE_CYCLES,
  MOVES,
  MOVE_FACES,
  STICKER_FACE_OF_SLOT,
  FIXED_CORNER_INDEX,
  CORNER_STICKERS,
} from './constants.js';

export const STATE_SIZE = 24;

function permutationFromCycles(cycles) {
  const perm = Array.from({ length: STATE_SIZE }, (_, i) => i);
  for (const cycle of cycles) {
    for (let i = 0; i < cycle.length; i++) {
      perm[cycle[(i + 1) % cycle.length]] = cycle[i];
    }
  }
  return perm;
}

function identityPermutation() {
  return Array.from({ length: STATE_SIZE }, (_, i) => i);
}

function composePermutations(first, second) {
  const composed = new Array(STATE_SIZE);
  for (let i = 0; i < STATE_SIZE; i++) composed[i] = first[second[i]];
  return composed;
}

function buildMovePermutation(move) {
  const face = move[0];
  const turns = move.endsWith('2') ? 2 : move.endsWith("'") ? 3 : 1;
  let perm = identityPermutation();
  const quarter = permutationFromCycles(BASE_MOVE_CYCLES[face]);
  for (let i = 0; i < turns; i++) perm = composePermutations(quarter, perm);
  return perm;
}

const MOVE_PERMUTATIONS = Object.fromEntries(
  MOVES.map((move) => [move, buildMovePermutation(move)])
);

const MOVE_INVERSES = Object.fromEntries(
  MOVES.map((move) => {
    const face = move[0];
    const inverse = move.endsWith('2') ? `${face}2` : move.endsWith("'") ? face : `${face}'`;
    return [move, inverse];
  })
);

export function solvedState() {
  return [...SOLVED_STATE];
}

export function isSolved(state) {
  for (let i = 0; i < STATE_SIZE; i++) if (state[i] !== SOLVED_STATE[i]) return false;
  return true;
}

export function applyMove(state, move) {
  const perm = MOVE_PERMUTATIONS[move];
  if (!perm) throw new Error(`Unknown move: ${move}`);
  const next = new Array(STATE_SIZE);
  for (let i = 0; i < STATE_SIZE; i++) next[i] = state[perm[i]];
  return next;
}

export function applyMoves(state, moves) {
  let next = state;
  for (const move of moves) next = applyMove(next, move);
  return next;
}

export function invertMove(move) {
  return MOVE_INVERSES[move];
}

export function invertMoves(moves) {
  return [...moves].reverse().map(invertMove);
}

export function stateHash(state) {
  return state.join(',');
}

export function movesEqual(a, b) {
  return a.length === b.length && a.every((move, i) => move === b[i]);
}

/**
 * Generates `count` random moves, never turning the same face twice in a row
 * (a redundant pair like `U U'`). `avoidFace` seeds the "previous face" so a
 * continuation never repeats the last face of an existing sequence.
 */
export function randomMoves(count, avoidFace = null) {
  const moves = [];
  let lastFace = avoidFace;
  for (let i = 0; i < count; i++) {
    const candidates = MOVE_FACES.filter((face) => face !== lastFace);
    const face = candidates[Math.floor(Math.random() * candidates.length)];
    const suffixes = ['', "'", '2'];
    moves.push(face + suffixes[Math.floor(Math.random() * suffixes.length)]);
    lastFace = face;
  }
  return moves;
}

export function scramble(depth = 7) {
  const scrambleMoves = randomMoves(depth);
  return { state: applyMoves(solvedState(), scrambleMoves), scrambleMoves };
}

export function cornerColors(state, positionIndex) {
  return CORNER_STICKERS[positionIndex].map((slot) => state[slot]);
}

export function cornerIsHomeAndOriented(state, positionIndex) {
  const home = CORNER_STICKERS[positionIndex];
  return home.every((slot) => state[slot] === STICKER_FACE_OF_SLOT[slot]);
}

export { MOVE_PERMUTATIONS, FIXED_CORNER_INDEX };
