'use client';

import { useState } from 'react';
import { NET_FACES, UNSET_COLOR, PALETTE } from '../constants.js';
import { COLORS } from '../../core/constants.js';

export default function CubeNetView({
  stickers,
  onPaintSlot,
  selectedColor,
  offendingSlots = [],
  colorBlind = false,
}) {
  const [isMouseDown, setIsMouseDown] = useState(false);

  const offendingSet = new Set(offendingSlots);

  const getCode = (colorId) => {
    const item = PALETTE.find((p) => p.id === colorId);
    return item ? item.code : '';
  };

  const handlePointerDown = (slot) => {
    setIsMouseDown(true);
    onPaintSlot(slot);
  };

  const handlePointerEnter = (slot) => {
    if (isMouseDown) {
      onPaintSlot(slot);
    }
  };

  const handlePointerUp = () => {
    setIsMouseDown(false);
  };

  return (
    <div
      className="smc-net-container"
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      role="region"
      aria-label="2D unfolded cube net"
    >
      <div className="smc-net-header">
        <span className="smc-net-title">2D Unfolded Net View</span>
        <span className="smc-net-hint">Click or drag across squares to paint</span>
      </div>

      <div className="smc-net-layout">
        {/* Row 0: Empty | Empty | U Face | Empty */}
        <div className="smc-net-row smc-net-row-top">
          <div className="smc-net-face-placeholder" />
          <div className="smc-net-face smc-face-u">
            <span className="smc-face-label">U (Up)</span>
            <div className="smc-face-grid">
              {NET_FACES[0].slots.map((slot) => renderSticker(slot))}
            </div>
          </div>
          <div className="smc-net-face-placeholder" />
          <div className="smc-net-face-placeholder" />
        </div>

        {/* Row 1: L | F | R | B Faces */}
        <div className="smc-net-row smc-net-row-middle">
          {/* L */}
          <div className="smc-net-face smc-face-l">
            <span className="smc-face-label">L (Left)</span>
            <div className="smc-face-grid">
              {NET_FACES[1].slots.map((slot) => renderSticker(slot))}
            </div>
          </div>
          {/* F */}
          <div className="smc-net-face smc-face-f">
            <span className="smc-face-label">F (Front)</span>
            <div className="smc-face-grid">
              {NET_FACES[2].slots.map((slot) => renderSticker(slot))}
            </div>
          </div>
          {/* R */}
          <div className="smc-net-face smc-face-r">
            <span className="smc-face-label">R (Right)</span>
            <div className="smc-face-grid">
              {NET_FACES[3].slots.map((slot) => renderSticker(slot))}
            </div>
          </div>
          {/* B */}
          <div className="smc-net-face smc-face-b">
            <span className="smc-face-label">B (Back)</span>
            <div className="smc-face-grid">
              {NET_FACES[4].slots.map((slot) => renderSticker(slot))}
            </div>
          </div>
        </div>

        {/* Row 2: Empty | Empty | D Face | Empty */}
        <div className="smc-net-row smc-net-row-bottom">
          <div className="smc-net-face-placeholder" />
          <div className="smc-net-face smc-face-d">
            <span className="smc-face-label">D (Down)</span>
            <div className="smc-face-grid">
              {NET_FACES[5].slots.map((slot) => renderSticker(slot))}
            </div>
          </div>
          <div className="smc-net-face-placeholder" />
          <div className="smc-net-face-placeholder" />
        </div>
      </div>
    </div>
  );

  function renderSticker(slot) {
    const colorId = stickers[slot];
    const isUnset = colorId === null || colorId === undefined || colorId < 0;
    const bg = isUnset ? UNSET_COLOR : COLORS[colorId];
    const isOffending = offendingSet.has(slot);
    const isDblAnchor = slot === 14 || slot === 18 || slot === 23;

    return (
      <button
        key={slot}
        type="button"
        className={`smc-net-sticker ${isUnset ? 'unset' : ''} ${
          isOffending ? 'offending' : ''
        }`}
        style={{ '--sticker-bg': bg }}
        onPointerDown={() => handlePointerDown(slot)}
        onPointerEnter={() => handlePointerEnter(slot)}
        title={`Slot ${slot} (${isUnset ? 'Unset' : getCode(colorId)})${
          isDblAnchor ? ' [Fixed DBL Corner]' : ''
        }`}
        aria-label={`Sticker ${slot}`}
      >
        {colorBlind && !isUnset && (
          <span className="smc-sticker-letter">{getCode(colorId)}</span>
        )}
        {isDblAnchor && <span className="smc-anchor-tag">DBL</span>}
      </button>
    );
  }
}
