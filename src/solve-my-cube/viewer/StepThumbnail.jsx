'use client';

import { COLORS } from '../../core/constants.js';
import { UNSET_COLOR } from '../constants.js';

/**
 * High-performance isometric vector thumbnail of the 2x2 cube.
 * Projects the 3 visible faces in isometric projection:
 * Up face (top rhombus), Front face (bottom-left rhombus), Right face (bottom-right rhombus).
 * Each face has 4 sticker quadrants.
 */
export default function StepThumbnail({ state, move = null, size = 110 }) {
  const getColor = (slot) => {
    if (!state || state[slot] === undefined || state[slot] === null || state[slot] < 0) {
      return UNSET_COLOR;
    }
    return COLORS[state[slot]];
  };

  // Isometric projection coordinates for standard unit cube:
  // Center origin at (60, 60), scaling factor s = 24
  // Up Face stickers: slots 0 (TL), 1 (TR), 2 (BL), 3 (BR)
  // Front Face stickers: slots 8 (TL), 9 (TR), 10 (BL), 11 (BR)
  // Right Face stickers: slots 4 (TL), 5 (TR), 6 (BL), 7 (BR)

  return (
    <svg
      className="smc-step-thumb-svg"
      width={size}
      height={size}
      viewBox="0 0 120 120"
      aria-hidden="true"
    >
      <defs>
        <filter id="thumb-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.4" />
        </filter>
        <marker
          id="arrow-head"
          markerWidth="5"
          markerHeight="5"
          refX="2.5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0,0 5,2.5 0,5" fill="var(--accent, #e39a3c)" />
        </marker>
        <marker
          id="arrow-head-ccw"
          markerWidth="5"
          markerHeight="5"
          refX="2.5"
          refY="2.5"
          orient="auto"
        >
          <polygon points="0,0 5,2.5 0,5" fill="var(--accent, #e39a3c)" />
        </marker>
      </defs>

      {/* Cube Body Background & Seam Lines */}
      <g filter="url(#thumb-shadow)">
        {/* ── TOP (UP) FACE ── */}
        {/* Slot 0: Top-Left (UBL corner) */}
        <polygon
          points="60,18 42,28.5 24,18 42,7.5"
          fill={getColor(0)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 1: Top-Right (UBR corner) */}
        <polygon
          points="78,28.5 60,18 78,7.5 96,18"
          fill={getColor(1)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 2: Bottom-Left (UFL corner) */}
        <polygon
          points="42,39 24,28.5 42,18 60,28.5"
          fill={getColor(2)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 3: Bottom-Right (UFR corner) */}
        <polygon
          points="60,39 42,28.5 60,18 78,28.5"
          fill={getColor(3)}
          stroke="#111318"
          strokeWidth="1.2"
        />

        {/* ── FRONT (F) FACE ── */}
        {/* Slot 8: Top-Left (UFL corner Front) */}
        <polygon
          points="24,39 42,49.5 42,69 24,58.5"
          fill={getColor(8)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 9: Top-Right (UFR corner Front) */}
        <polygon
          points="42,49.5 60,39 60,58.5 42,69"
          fill={getColor(9)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 10: Bottom-Left (DFL corner Front) */}
        <polygon
          points="24,58.5 42,69 42,88.5 24,78"
          fill={getColor(10)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 11: Bottom-Right (DFR corner Front) */}
        <polygon
          points="42,69 60,58.5 60,78 42,88.5"
          fill={getColor(11)}
          stroke="#111318"
          strokeWidth="1.2"
        />

        {/* ── RIGHT (R) FACE ── */}
        {/* Slot 4: Top-Left (UFR corner Right) */}
        <polygon
          points="60,39 78,49.5 78,69 60,58.5"
          fill={getColor(4)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 5: Top-Right (UBR corner Right) */}
        <polygon
          points="78,49.5 96,39 96,58.5 78,69"
          fill={getColor(5)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 6: Bottom-Left (DFR corner Right) */}
        <polygon
          points="60,58.5 78,69 78,88.5 60,78"
          fill={getColor(6)}
          stroke="#111318"
          strokeWidth="1.2"
        />
        {/* Slot 7: Bottom-Right (DBR corner Right) */}
        <polygon
          points="78,69 96,58.5 96,78 78,88.5"
          fill={getColor(7)}
          stroke="#111318"
          strokeWidth="1.2"
        />
      </g>

      {/* Move Arrow Overlay */}
      {renderMoveArrow(move)}
    </svg>
  );

  function renderMoveArrow(m) {
    if (!m) return null;
    const face = m[0];
    const isCcw = m.includes("'");
    const isDouble = m.includes('2');

    if (face === 'U') {
      return (
        <path
          d={
            isCcw
              ? 'M 74 18 Q 60 10 46 18'
              : 'M 46 18 Q 60 10 74 18'
          }
          fill="none"
          stroke="var(--accent, #e39a3c)"
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#arrow-head)"
        />
      );
    }

    if (face === 'R') {
      return (
        <path
          d={
            isCcw
              ? 'M 88 50 Q 92 64 88 78'
              : 'M 88 78 Q 92 64 88 50'
          }
          fill="none"
          stroke="var(--accent, #e39a3c)"
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#arrow-head)"
        />
      );
    }

    if (face === 'F') {
      return (
        <path
          d={
            isCcw
              ? 'M 32 78 Q 28 64 32 50'
              : 'M 32 50 Q 28 64 32 78'
          }
          fill="none"
          stroke="var(--accent, #e39a3c)"
          strokeWidth="2.5"
          strokeLinecap="round"
          markerEnd="url(#arrow-head)"
        />
      );
    }

    return null;
  }
}
