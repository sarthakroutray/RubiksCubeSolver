'use client';

import { useRef } from 'react';
import { RefreshCamIcon } from './icons';

const VIEWS = [
  ['iso', 'Iso', 'Isometric view'],
  ['front', 'Front', 'Front face'],
  ['top', 'Top', 'Top face'],
  ['right', 'Right', 'Right face'],
];

export default function CubeStage({
  containerRef,
  cameraView,
  onView,
  onResetCamera,
  onStageClick,
  mode = 'explore',
}) {
  const downPosRef = useRef({ x: 0, y: 0, time: 0 });

  const handlePointerDown = (e) => {
    downPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handlePointerUp = (e) => {
    const dx = e.clientX - downPosRef.current.x;
    const dy = e.clientY - downPosRef.current.y;
    const dist = Math.hypot(dx, dy);
    // If movement was small, it's a click to paint (not a camera rotation drag)
    if (dist < 6 && typeof onStageClick === 'function') {
      onStageClick(e.clientX, e.clientY);
    }
  };

  return (
    <section className="stage">
      <div
        className="stage-canvas"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />

      <div className="stage-toolbar">
        <div className="segmented" role="group" aria-label="Camera view">
          {VIEWS.map(([id, label, title]) => (
            <button
              key={id}
              type="button"
              className={`seg-btn ${cameraView === id ? 'active' : ''}`}
              onClick={() => onView(id)}
              title={title}
              aria-pressed={cameraView === id}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={onResetCamera}
          title="Reset camera"
          aria-label="Reset camera"
        >
          <RefreshCamIcon size={14} />
        </button>
      </div>

      <span className="stage-hint">
        {mode === 'solve'
          ? 'Click 3D sticker to paint · Drag to rotate · Scroll to zoom'
          : 'Drag to rotate · Scroll to zoom'}
      </span>
    </section>
  );
}
