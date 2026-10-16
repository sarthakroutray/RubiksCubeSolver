'use client';

export default function FaceControls({ faceGroups, onMove, disabled }) {
  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">Face turns</span>
        <span className="section-actions">
          <span className="section-meta">U · F · shift = counter-clockwise · alt+R</span>
        </span>
      </div>
      <div className="keypad">
        {faceGroups.map((group) => (
          <div className="keypad-group" key={group.face}>
            <span className="keypad-label">
              {group.name} ({group.face})
            </span>
            <div className="keypad-keys">
              {group.turns.map(({ move, dir }) => (
                <button
                  key={move}
                  type="button"
                  className="key"
                  onClick={() => onMove(move)}
                  disabled={disabled}
                  title={`${group.name} face · ${dir}`}
                >
                  <span className="key-move">{move}</span>
                  <span className="key-dir">{dir}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
