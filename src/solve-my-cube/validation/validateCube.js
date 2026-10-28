import {
  CORNER_STICKERS,
  CORNER_HOME_COORDS,
  STICKER_FACE_OF_SLOT,
  COLOR_NAMES,
} from '../../core/constants.js';
import { isSolved } from '../../core/CubeState.js';
import { normalizeOrientation, FACE_NORMALS } from '../conversion/normalizeOrientation.js';

// Precompute clockwise face triplets (ud -> cw1 -> cw2) for each of the 8 physical corner slots
export const CORNER_CW_FACES = [];
for (let ci = 0; ci < 8; ci++) {
  const [cx, cy, cz] = CORNER_HOME_COORDS[ci];
  const udFace = cy > 0 ? 0 : 3;
  const rlFace = cx > 0 ? 1 : 4;
  const fbFace = cz > 0 ? 2 : 5;

  const vUD = FACE_NORMALS[udFace];
  const vRL = FACE_NORMALS[rlFace];

  const crossRL = [
    vUD[1] * vRL[2] - vUD[2] * vRL[1],
    vUD[2] * vRL[0] - vUD[0] * vRL[2],
    vUD[0] * vRL[1] - vUD[1] * vRL[0],
  ];
  const dotRL = crossRL[0] * cx + crossRL[1] * cy + crossRL[2] * cz;
  if (dotRL > 0) {
    CORNER_CW_FACES.push({ ud: udFace, cw1: rlFace, cw2: fbFace });
  } else {
    CORNER_CW_FACES.push({ ud: udFace, cw1: fbFace, cw2: rlFace });
  }
}

// Canonical clockwise color cycles for the 8 corner pieces (identified by home corner index 0..7)
export const CANONICAL_CORNER_CYCLES = CORNER_CW_FACES.map((f) => [f.ud, f.cw1, f.cw2]);

export const CANONICAL_CORNER_SETS = CANONICAL_CORNER_CYCLES.map(
  (cycle) => new Set(cycle)
);

/**
 * Calculates orientation twist (0, 1, or 2) of a corner in a given state
 */
export function getCornerTwist(state, ci) {
  const slots = CORNER_STICKERS[ci];
  const cw = CORNER_CW_FACES[ci];
  for (const s of slots) {
    const col = state[s];
    if (col === 0 || col === 3) {
      const face = STICKER_FACE_OF_SLOT[s];
      if (face === cw.ud) return 0;
      if (face === cw.cw1) return 1;
      if (face === cw.cw2) return 2;
    }
  }
  return 0;
}

/**
 * Validates a 24-sticker cube state painted by the user.
 * Returns: {
 *   valid: boolean,
 *   isSolved: boolean,
 *   normalizedState: number[] | null,
 *   normalizationInfo: object | null,
 *   error: string | null,
 *   offendingSlots: number[],
 *   counts: { [colorId: number]: number },
 *   unsetCount: number,
 * }
 */
export function validateCube(stickers) {
  const result = {
    valid: false,
    isSolved: false,
    normalizedState: null,
    normalizationInfo: null,
    error: null,
    offendingSlots: [],
    counts: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    unsetCount: 0,
  };

  if (!stickers || stickers.length !== 24) {
    result.error = 'Invalid cube array size (must be 24 stickers).';
    return result;
  }

  // 1. Check for unset stickers
  const unsetSlots = [];
  for (let i = 0; i < 24; i++) {
    const val = stickers[i];
    if (val === null || val === undefined || val < 0 || val > 5) {
      unsetSlots.push(i);
    } else {
      result.counts[val] = (result.counts[val] || 0) + 1;
    }
  }

  result.unsetCount = unsetSlots.length;
  if (unsetSlots.length > 0) {
    result.offendingSlots = unsetSlots;
    result.error = `${unsetSlots.length} sticker${unsetSlots.length > 1 ? 's' : ''} left to paint.`;
    return result;
  }

  // 2. Check color counts (each must appear exactly 4 times)
  const invalidColorSlots = [];
  const countErrors = [];
  for (let c = 0; c < 6; c++) {
    const count = result.counts[c] || 0;
    if (count !== 4) {
      countErrors.push(`${COLOR_NAMES[c]}: ${count}/4`);
      for (let s = 0; s < 24; s++) {
        if (stickers[s] === c) invalidColorSlots.push(s);
      }
    }
  }

  if (countErrors.length > 0) {
    result.offendingSlots = invalidColorSlots;
    result.error = `Each color must appear exactly 4 times (${countErrors.join(', ')}).`;
    return result;
  }

  // 3. Normalize orientation & color scheme
  const norm = normalizeOrientation(stickers);
  result.normalizationInfo = norm;

  if (!norm.success) {
    result.error =
      'Could not find a valid cube reference orientation. Check that corner colors form valid opposite faces.';
    return result;
  }

  const canon = norm.canonicalState;
  result.normalizedState = canon;

  // 4. Verify corners on the normalized state
  const seenCorners = new Map(); // pieceIndex -> physicalCornerIndex
  for (let ci = 0; ci < 8; ci++) {
    const slots = CORNER_STICKERS[ci];
    const colors = slots.map((s) => canon[s]);
    const colorSet = new Set(colors);

    // Find which canonical corner piece this matches by color set
    let matchIndex = -1;
    for (let def = 0; def < 8; def++) {
      const defSet = CANONICAL_CORNER_SETS[def];
      if (colorSet.size === 3 && [...colorSet].every((c) => defSet.has(c))) {
        matchIndex = def;
        break;
      }
    }

    if (matchIndex === -1) {
      result.offendingSlots = slots;
      const names = colors.map((c) => COLOR_NAMES[norm.inverseColorMap[c]]);
      result.error = `Invalid corner: ${names.join('-')} has incompatible or opposite colors.`;
      return result;
    }

    if (seenCorners.has(matchIndex)) {
      const prevCi = seenCorners.get(matchIndex);
      result.offendingSlots = [...slots, ...CORNER_STICKERS[prevCi]];
      const names = colors.map((c) => COLOR_NAMES[norm.inverseColorMap[c]]);
      result.error = `Duplicate corner: A ${names.join('-')} corner appears more than once.`;
      return result;
    }
    seenCorners.set(matchIndex, ci);

    // Chirality check
    const cw = CORNER_CW_FACES[ci];
    const slotUD = slots.find((s) => STICKER_FACE_OF_SLOT[s] === cw.ud);
    const slotCW1 = slots.find((s) => STICKER_FACE_OF_SLOT[s] === cw.cw1);
    const slotCW2 = slots.find((s) => STICKER_FACE_OF_SLOT[s] === cw.cw2);

    const cUD = canon[slotUD];
    const cCW1 = canon[slotCW1];
    const cCW2 = canon[slotCW2];

    const pCycle = CANONICAL_CORNER_CYCLES[matchIndex];
    const idx0 = pCycle.indexOf(cUD);
    const isChiralMatch =
      idx0 !== -1 &&
      pCycle[(idx0 + 1) % 3] === cCW1 &&
      pCycle[(idx0 + 2) % 3] === cCW2;

    if (!isChiralMatch) {
      result.offendingSlots = slots;
      const names = colors.map((c) => COLOR_NAMES[norm.inverseColorMap[c]]);
      result.error = `Impossible corner: ${names.join('-')} is physically mirrored (wrong chirality).`;
      return result;
    }
  }

  // 5. Corner twist parity check
  let totalTwist = 0;
  const twistedSlots = [];
  for (let ci = 0; ci < 8; ci++) {
    const twist = getCornerTwist(canon, ci);
    if (twist !== 0) {
      twistedSlots.push(...CORNER_STICKERS[ci]);
    }
    totalTwist = (totalTwist + twist) % 3;
  }

  if (totalTwist !== 0) {
    result.offendingSlots = twistedSlots;
    result.error =
      'Corner twist parity error: One or more corners have been physically twisted (total twist parity invalid).';
    return result;
  }

  // 6. Valid state check
  result.valid = true;
  if (isSolved(canon)) {
    result.isSolved = true;
  }

  return result;
}
