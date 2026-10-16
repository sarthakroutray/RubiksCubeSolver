export const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'];

export const FACE_ID = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };

export const COLORS = {
  0: '#f8fafc',
  1: '#ef4444',
  2: '#22c55e',
  3: '#facc15',
  4: '#f97316',
  5: '#3b82f6',
};

export const COLOR_NAMES = ['White', 'Red', 'Green', 'Yellow', 'Orange', 'Blue'];

export const SOLVED_STATE = Object.freeze([
  0, 0, 0, 0,
  1, 1, 1, 1,
  2, 2, 2, 2,
  3, 3, 3, 3,
  4, 4, 4, 4,
  5, 5, 5, 5,
]);

export const CORNER_NAMES = ['UFL', 'UFR', 'UBR', 'UBL', 'DFL', 'DFR', 'DBR', 'DBL'];

export const CORNER_STICKERS = [
  [2, 8, 17],
  [3, 9, 4],
  [1, 5, 20],
  [0, 21, 16],
  [12, 19, 10],
  [13, 11, 6],
  [15, 7, 22],
  [14, 23, 18],
];

export const CORNER_HOME_COORDS = [
  [-1, 1, 1],
  [1, 1, 1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, -1, -1],
  [-1, -1, -1],
];

export const FIXED_CORNER_INDEX = 7;

export const STICKER_FACE_OF_SLOT = Object.freeze(
  Array.from({ length: 24 }, (_, i) => Math.floor(i / 4))
);

// Cycle notation [a, b, c, d]: the sticker value at a moves to b, b to c, c to d, d to a.
// Derived geometrically from CORNER_STICKERS + standard clockwise quarter turns
// (U: -90deg about +Y, R: -90deg about +X, F: -90deg about +Z).
export const BASE_MOVE_CYCLES = {
  U: [[0, 1, 3, 2], [8, 16, 20, 4], [17, 21, 5, 9]],
  R: [[4, 5, 7, 6], [3, 20, 15, 11], [9, 1, 22, 13]],
  F: [[8, 9, 11, 10], [2, 4, 13, 19], [3, 6, 12, 17]],
};

export const MOVES = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2'];

export const MOVE_FACES = ['U', 'R', 'F'];
