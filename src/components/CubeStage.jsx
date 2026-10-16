'use client';

import { RefreshCamIcon } from './icons';

const VIEWS = [
  ['iso', 'Iso', 'Isometric view'],
  ['front', 'Front', 'Front face'],
  ['top', 'Top', 'Top face'],
  ['right', 'Right', 'Right face'],
];

export default function CubeStage({ containerRef, cameraView, onView, onResetCamera }) {
  return (
    <section className="stage">
      <div className="stage-canvas" ref={containerRef} />

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

      <span className="stage-hint">Drag to rotate · Scroll to zoom</span>
    </section>
  );
}
