'use client';

import { useEffect } from 'react';
import { KeyboardIcon, CloseIcon } from './icons';

const SHORTCUTS = [
  ['Run or stop the search', [['Space']]],
  ['Stop the search', [['Esc']]],
  ['Scramble 7 moves', [['S']]],
  ['Reset the cube', [['R']]],
  ['Turn the up face', [['U'], ['Shift', 'U']]],
  ['Turn the right face', [['Alt', 'R']]],
  ['Turn the front face', [['F'], ['Shift', 'F']]],
  ['Toggle this panel', [['?']]],
];

export default function ShortcutsModal({ open, onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={`modal ${open ? 'open' : ''}`}
      aria-hidden={!open}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        <div className="modal-head">
          <div className="modal-title">
            <KeyboardIcon size={16} />
            Keyboard shortcuts
          </div>
          <button type="button" className="modal-close" onClick={onClose} title="Close (Esc)" aria-label="Close">
            <CloseIcon size={15} />
          </button>
        </div>
        <div className="modal-body">
          {SHORTCUTS.map(([desc, combos]) => (
            <div className="shortcut-row" key={desc}>
              <span className="shortcut-desc">{desc}</span>
              <div className="shortcut-keys">
                {combos.map((keys, i) => (
                  <span className="shortcut-keys" key={keys.join('+')}>
                    {i > 0 && <span className="key-or">/</span>}
                    {keys.map((k, j) => (
                      <span key={k} className="shortcut-keys">
                        {j > 0 && <span className="key-or">+</span>}
                        <kbd>{k}</kbd>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
