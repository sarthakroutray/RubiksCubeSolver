'use client';

export default function CelebrationModal({
  open = false,
  onClose,
  onVerifyReplay,
  moveCount = 0,
  algorithm = 'A*',
  elapsedMs = 0,
}) {
  if (!open) return null;

  return (
    <div className="smc-modal-overlay" role="dialog" aria-modal="true">
      <div className="smc-modal-card smc-celebration-card">
        <div className="smc-celebration-badge">🎉 100% SOLVED!</div>
        <h2 className="smc-celebration-title">Cube Successfully Solved!</h2>
        <p className="smc-celebration-desc">
          Your physical cube should now have all solid faces matching the 3D model.
        </p>

        <div className="smc-stats-pills">
          <div className="smc-stat-pill">
            <span className="smc-stat-val">{moveCount}</span>
            <span className="smc-stat-lbl">Moves</span>
          </div>
          <div className="smc-stat-pill">
            <span className="smc-stat-val">{algorithm}</span>
            <span className="smc-stat-lbl">Algorithm</span>
          </div>
          <div className="smc-stat-pill">
            <span className="smc-stat-val">{elapsedMs}ms</span>
            <span className="smc-stat-lbl">Compute Time</span>
          </div>
        </div>

        <div className="smc-celebration-actions">
          <button
            type="button"
            className="btn-accent"
            onClick={onVerifyReplay}
          >
            🔍 Verify Against My Cube (Replay)
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
