'use client';

import { useRef, useEffect } from 'react';
import StepThumbnail from './StepThumbnail.jsx';
import { MOVE_CAPTIONS } from '../constants.js';

export default function StepCardGrid({
  steps = [],
  activeStepIndex = -1,
  onSelectStep,
  beginnerMode = false,
  beginnerPhases = [],
}) {
  const scrollContainerRef = useRef(null);

  // Auto-scroll active card into view during playback
  useEffect(() => {
    if (activeStepIndex >= 0 && scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector(
        `[data-step-index="${activeStepIndex}"]`
      );
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeStepIndex]);

  if (!steps || steps.length === 0) {
    return (
      <div className="smc-empty-cards">
        <span>No steps to display. Paint your cube and click "Solve My Cube" to generate steps.</span>
      </div>
    );
  }

  return (
    <div className="smc-step-grid-wrapper">
      <div className="smc-step-grid-scroll" ref={scrollContainerRef}>
        {steps.map((step, idx) => {
          const isActive = activeStepIndex === idx;
          const caption = MOVE_CAPTIONS[step.move] || `Turn ${step.move}`;
          const phase = beginnerMode && beginnerPhases[idx] ? beginnerPhases[idx] : null;

          return (
            <div key={idx} className="smc-step-card-col">
              {beginnerMode && phase && phase.isPhaseStart && (
                <div className="smc-phase-header">
                  <span className="smc-phase-badge">{phase.phaseBadge}</span>
                  <span className="smc-phase-title">{phase.phaseTitle}</span>
                </div>
              )}

              <button
                type="button"
                className={`smc-step-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelectStep(idx)}
                data-step-index={idx}
                aria-label={`Step ${idx + 1}: ${step.move} - ${caption}`}
                aria-current={isActive ? 'step' : undefined}
              >
                <div className="smc-card-top">
                  <span className="smc-step-num">Step {idx + 1}</span>
                  <span className="smc-step-notation">{step.move}</span>
                </div>

                <div className="smc-card-thumb">
                  <StepThumbnail state={step.stateAfter} move={step.move} size={90} />
                </div>

                <div className="smc-card-bottom">
                  <span className="smc-step-caption">{caption}</span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
