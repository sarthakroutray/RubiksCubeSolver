import {
  CORNER_STICKERS,
  CORNER_HOME_COORDS,
  STICKER_FACE_OF_SLOT,
  FIXED_CORNER_INDEX,
} from '../core/constants.js';

export function misplacedStickers(state) {
  let count = 0;
  for (let i = 0; i < 24; i++) {
    if (state[i] !== STICKER_FACE_OF_SLOT[i]) count++;
  }
  return count;
}

export function h1(state) {
  return misplacedStickers(state) / 12;
}

export function hCubie(state) {
  let count = 0;
  for (let p = 0; p < 8; p++) {
    if (p === FIXED_CORNER_INDEX) continue;
    const correct = CORNER_STICKERS[p].every(
      (slot) => state[slot] === STICKER_FACE_OF_SLOT[slot]
    );
    if (!correct) count++;
  }
  return count / 4;
}

const HOME_BY_COLORS = new Map();
for (let p = 0; p < 8; p++) {
  const key = CORNER_STICKERS[p]
    .map((slot) => STICKER_FACE_OF_SLOT[slot])
    .sort()
    .join('');
  HOME_BY_COLORS.set(key, p);
}

export function cornerHomePosition(state, positionIndex) {
  const key = CORNER_STICKERS[positionIndex]
    .map((slot) => state[slot])
    .sort()
    .join('');
  return HOME_BY_COLORS.get(key);
}

export function cornerManhattanDistance(state) {
  let total = 0;
  for (let p = 0; p < 8; p++) {
    const home = cornerHomePosition(state, p);
    if (home === p) continue;
    const from = CORNER_HOME_COORDS[p];
    const to = CORNER_HOME_COORDS[home];
    let mismatches = 0;
    for (let axis = 0; axis < 3; axis++) {
      if (from[axis] !== to[axis]) mismatches++;
    }
    total += mismatches === 3 ? 2 : 1;
  }
  return total;
}

export function h2(state) {
  return cornerManhattanDistance(state) / 4;
}

export function h0() {
  return 0;
}

export const HEURISTICS = {
  h2: { id: 'h2', label: '3D Manhattan Corner Distance (h2)', fn: h2 },
  h1: { id: 'h1', label: 'Misplaced Stickers / 12 (h1)', fn: h1 },
  h0: { id: 'h0', label: 'Zero Heuristic / BFS (h=0)', fn: h0 },
};

export function getHeuristic(id) {
  const entry = HEURISTICS[id];
  if (!entry) throw new Error(`Unknown heuristic: ${id}`);
  return entry.fn;
}
