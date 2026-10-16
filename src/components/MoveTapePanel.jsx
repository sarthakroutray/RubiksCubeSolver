'use client';

import { useEffect, useRef } from 'react';
import { CopyIcon, CheckIcon } from './icons';

export default function MoveTapePanel({ tape, activeStep, onStep, onCopy, copied, status, isSearching }) {
  const activeRef = useRef(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeStep]);

  const count = tape.length;

  return (
    <div className="section">
      <div className="section-head">
        <span className="section-title">Move tape</span>
        <span className="section-meta">
          {count} move{count === 1 ? '' : 's'}
        </span>
        <span className="section-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onCopy}
            disabled={count === 0}
            title="Copy the sequence"
          >
            {copied ? <CheckIcon size={12} /> : <CopyIcon size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </span>
      </div>

      <div className="tape">
        {count === 0 ? (
          <span className="tape-empty">No moves yet. Scramble or turn a face.</span>
        ) : (
          tape.map((entry) => {
            const isActive = entry.index === activeStep;
            const isDone = entry.index < activeStep;
            return (
              <button
                key={`${entry.index}-${entry.move}`}
                type="button"
                ref={isActive ? activeRef : null}
                className={`tape-chip ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                onClick={() => onStep(entry.index)}
                disabled={isSearching}
                title={isSearching ? 'Preview is disabled during a search' : 'Preview this state'}
              >
                <span className="tape-idx">{entry.index + 1}</span>
                {entry.move}
              </button>
            );
          })
        )}
      </div>

      <div className="logline" data-kind={status.kind} title={status.text}>
        {status.text}
      </div>
    </div>
  );
}
