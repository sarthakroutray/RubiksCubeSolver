import { COLORS, COLOR_NAMES, FACE_NAMES } from '../core/constants.js';

export const UNSET_COLOR = '#2b2d35';
export const UNSET_ID = -1;

export const PALETTE = [
  { id: 0, name: 'White', color: COLORS[0], code: 'W', textDark: true },
  { id: 3, name: 'Yellow', color: COLORS[3], code: 'Y', textDark: true },
  { id: 2, name: 'Green', color: COLORS[2], code: 'G', textDark: false },
  { id: 5, name: 'Blue', color: COLORS[5], code: 'B', textDark: false },
  { id: 1, name: 'Red', color: COLORS[1], code: 'R', textDark: false },
  { id: 4, name: 'Orange', color: COLORS[4], code: 'O', textDark: false },
];

export const MOVE_CAPTIONS = {
  U: 'Turn the Up face clockwise 90°',
  "U'": 'Turn the Up face counter-clockwise 90°',
  U2: 'Turn the Up face 180°',
  R: 'Turn the Right face clockwise 90°',
  "R'": 'Turn the Right face counter-clockwise 90°',
  R2: 'Turn the Right face 180°',
  F: 'Turn the Front face clockwise 90°',
  "F'": 'Turn the Front face counter-clockwise 90°',
  F2: 'Turn the Front face 180°',
};

// 2D unfolded cross net order:
//        [ U ]
//  [ L ] [ F ] [ R ] [ B ]
//        [ D ]
export const NET_FACES = [
  { face: 'U', faceId: 0, name: 'Up', slots: [0, 1, 2, 3] },
  { face: 'L', faceId: 4, name: 'Left', slots: [16, 17, 18, 19] },
  { face: 'F', faceId: 2, name: 'Front', slots: [8, 9, 10, 11] },
  { face: 'R', faceId: 1, name: 'Right', slots: [4, 5, 6, 7] },
  { face: 'B', faceId: 5, name: 'Back', slots: [20, 21, 22, 23] },
  { face: 'D', faceId: 3, name: 'Down', slots: [12, 13, 14, 15] },
];

export const STORAGE_KEY = 'pocketcube_solve_my_cube_stickers_v1';
