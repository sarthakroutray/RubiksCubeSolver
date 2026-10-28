import {
  CORNER_STICKERS,
  CORNER_HOME_COORDS,
  STICKER_FACE_OF_SLOT,
  FIXED_CORNER_INDEX,
  SOLVED_STATE,
} from '../../core/constants.js';

// Normal vectors for each face ID: 0:U, 1:R, 2:F, 3:D, 4:L, 5:B
export const FACE_NORMALS = [
  [0, 1, 0],   // 0: U
  [1, 0, 0],   // 1: R
  [0, 0, 1],   // 2: F
  [0, -1, 0],  // 3: D
  [-1, 0, 0],  // 4: L
  [0, 0, -1],  // 5: B
];

// Returns slot index (0..23) given corner index (0..7) and normal vector
function findSlot(cornerIndex, normal) {
  const [nx, ny, nz] = normal;
  const slots = CORNER_STICKERS[cornerIndex];
  for (const slot of slots) {
    const face = STICKER_FACE_OF_SLOT[slot];
    const [fnx, fny, fnz] = FACE_NORMALS[face];
    if (fnx === nx && fny === ny && fnz === nz) return slot;
  }
  return -1;
}

// Generate the 24 3x3 rotation matrices in SO(3) with entries in {-1, 0, 1} and det = 1
export function generateRotationMatrices() {
  const matrices = [];
  const axes = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ];

  for (const x of axes) {
    for (const y of axes) {
      // Must be orthogonal
      if (x[0] * y[0] + x[1] * y[1] + x[2] * y[2] !== 0) continue;
      // Cross product z = x × y
      const z = [
        x[1] * y[2] - x[2] * y[1],
        x[2] * y[0] - x[0] * y[2],
        x[0] * y[1] - x[1] * y[0],
      ];
      // Determinant is +1 by construction of right-handed orthonormal basis
      matrices.push([
        [x[0], y[0], z[0]],
        [x[1], y[1], z[1]],
        [x[2], y[2], z[2]],
      ]);
    }
  }
  return matrices;
}

const ROTATION_MATRICES = generateRotationMatrices();

// Multiply 3x3 matrix by 3D vector
function multMatVec(m, v) {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

function findCornerByCoords(coords) {
  const [x, y, z] = coords;
  for (let i = 0; i < CORNER_HOME_COORDS.length; i++) {
    const [hx, hy, hz] = CORNER_HOME_COORDS[i];
    if (hx === x && hy === y && hz === z) return i;
  }
  return -1;
}

// Precompute slot permutations for each of the 24 rotation matrices
// rotatedState[targetSlot] = originalState[slotPerm[targetSlot]]
export const ROTATION_PERMUTATIONS = ROTATION_MATRICES.map((m) => {
  const perm = new Array(24);
  for (let c = 0; c < 8; c++) {
    const origCoords = CORNER_HOME_COORDS[c];
    const rotatedCoords = multMatVec(m, origCoords);
    const targetCorner = findCornerByCoords(rotatedCoords);

    for (const slot of CORNER_STICKERS[c]) {
      const face = STICKER_FACE_OF_SLOT[slot];
      const origNormal = FACE_NORMALS[face];
      const rotatedNormal = multMatVec(m, origNormal);
      const targetSlot = findSlot(targetCorner, rotatedNormal);
      perm[targetSlot] = slot;
    }
  }
  return perm;
});

/**
 * Apply rotation permutation to a 24-element sticker state
 */
export function rotateState(state, rotIndex) {
  const perm = ROTATION_PERMUTATIONS[rotIndex];
  const next = new Array(24);
  for (let i = 0; i < 24; i++) {
    next[i] = state[perm[i]];
  }
  return next;
}

/**
 * Given 8 corner sticker triplets from painted state, identify opposite color pairs.
 * On a valid 2x2 cube, two colors are opposite iff they never appear on the same corner.
 */
export function detectOppositeColors(stickers) {
  const cooccur = Array.from({ length: 6 }, () => new Set());

  for (const cornerSlots of CORNER_STICKERS) {
    const colors = cornerSlots.map((s) => stickers[s]);
    if (colors.some((c) => c === null || c === undefined || c < 0 || c > 5)) {
      return null;
    }
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (i !== j) cooccur[colors[i]].add(colors[j]);
      }
    }
  }

  const oppositeMap = new Map();
  for (let c = 0; c < 6; c++) {
    const nonCooccurring = [];
    for (let other = 0; other < 6; other++) {
      if (other !== c && !cooccur[c].has(other)) {
        nonCooccurring.push(other);
      }
    }
    if (nonCooccurring.length !== 1) {
      return null; // Invalid color distribution across corners
    }
    oppositeMap.set(c, nonCooccurring[0]);
  }
  return oppositeMap;
}

/**
 * Derives color mapping from user color IDs to canonical colors {0..5}
 * Standard: 0=White, 1=Red, 2=Green, 3=Yellow, 4=Orange, 5=Blue
 * Canonical opposites: 0<->3 (U/D), 1<->4 (R/L), 2<->5 (F/B)
 */
export function deriveColorMap(stickers) {
  const opposites = detectOppositeColors(stickers);
  if (!opposites) return null;

  // Check if standard scheme is already used (0<->3, 1<->4, 2<->5)
  const isStandard =
    opposites.get(0) === 3 &&
    opposites.get(1) === 4 &&
    opposites.get(2) === 5;

  if (isStandard) {
    const identityMap = [0, 1, 2, 3, 4, 5];
    return { colorMap: identityMap, inverseColorMap: identityMap };
  }

  // If non-standard, partition colors into 3 opposite pairs
  const visited = new Set();
  const pairs = [];
  for (let c = 0; c < 6; c++) {
    if (!visited.has(c)) {
      const opp = opposites.get(c);
      visited.add(c);
      visited.add(opp);
      pairs.push([c, opp]);
    }
  }

  if (pairs.length !== 3) return null;

  // Assign pair 0 to U/D, pair 1 to R/L, pair 2 to F/B
  // Respecting right-handed chirality using a reference corner
  // Canonical UFR corner (corner 1) has colors U (0), F (2), R (1).
  // Clockwise order around corner 1 is U -> F -> R -> U.
  for (let uIdx = 0; uIdx < 2; uIdx++) {
    const uColor = pairs[0][uIdx];
    const dColor = pairs[0][1 - uIdx];

    for (let rIdx = 0; rIdx < 2; rIdx++) {
      const rColor = pairs[1][rIdx];
      const lColor = pairs[1][1 - rIdx];

      for (let fIdx = 0; fIdx < 2; fIdx++) {
        const fColor = pairs[2][fIdx];
        const bColor = pairs[2][1 - fIdx];

        const map = new Array(6);
        map[uColor] = 0;
        map[rColor] = 1;
        map[fColor] = 2;
        map[dColor] = 3;
        map[lColor] = 4;
        map[bColor] = 5;

        // Verify that this mapping yields correct chirality for all 8 corners
        let allValid = true;
        for (let ci = 0; ci < 8; ci++) {
          const slots = CORNER_STICKERS[ci];
          const cColors = slots.map((s) => map[stickers[s]]);
          const targetCorner = ci;
          const targetSlots = CORNER_STICKERS[targetCorner];
          const targetColors = targetSlots.map((s) => STICKER_FACE_OF_SLOT[s]);

          // Check if set of colors matches canonical corner
          const setA = new Set(cColors);
          const setB = new Set(targetColors);
          if (setA.size !== 3 || [...setA].some((col) => !setB.has(col))) {
            allValid = false;
            break;
          }
        }

        if (allValid) {
          const inverse = new Array(6);
          for (let i = 0; i < 6; i++) inverse[map[i]] = i;
          return { colorMap: map, inverseColorMap: inverse };
        }
      }
    }
  }

  // Fallback to identity if pairing couldn't find chirality match
  const identity = [0, 1, 2, 3, 4, 5];
  return { colorMap: identity, inverseColorMap: identity };
}

/**
 * Normalizes user sticker state to canonical internal state where:
 * - Colors are canonical {0..5}
 * - DBL corner (slot 14=3/D, 23=5/B, 18=4/L) is fixed as reference
 */
export function normalizeOrientation(stickers) {
  const scheme = deriveColorMap(stickers);
  const colorMap = scheme ? scheme.colorMap : [0, 1, 2, 3, 4, 5];
  const inverseColorMap = scheme ? scheme.inverseColorMap : [0, 1, 2, 3, 4, 5];

  // Map user colors to canonical colors
  const mapped = stickers.map((c) => (c >= 0 && c <= 5 ? colorMap[c] : c));

  // Find the spatial rotation (among 24) that brings the DBL corner piece (Yellow=3, Blue=5, Orange=4)
  // to the DBL corner slot (index 7, slots 14, 23, 18) with exact orientation (D=3, B=5, L=4).
  for (let rot = 0; rot < 24; rot++) {
    const rotated = rotateState(mapped, rot);
    // DBL slots: 14 is on D (3), 23 is on B (5), 18 is on L (4)
    if (rotated[14] === 3 && rotated[23] === 5 && rotated[18] === 4) {
      return {
        canonicalState: rotated,
        rotationIndex: rot,
        colorMap,
        inverseColorMap,
        success: true,
      };
    }
  }

  // If no rotation oriented DBL exactly, return unrotated mapped state for validator to flag
  return {
    canonicalState: mapped,
    rotationIndex: 0,
    colorMap,
    inverseColorMap,
    success: false,
  };
}
