/**
 * Human-style beginner method breakdown and annotations.
 * Partitions a solution or guides the user through classic 2x2 layer-by-layer concepts:
 * 1. Base Layer (orient & place reference base corners)
 * 2. Orient Last Layer (OLL: get all top stickers pointing up)
 * 3. Permute Last Layer (PLL: swap adjacent/diagonal corners)
 */

export const BEGINNER_PHASES = [
  {
    id: 'base',
    title: 'Phase 1: Build the First Layer',
    badge: 'Step 1: Base Layer',
    description:
      'Align corners adjacent to the fixed DBL anchor to form a completed bottom layer with matching side bands.',
    tip: 'Hold the cube with the reference corner on the bottom-back-left.',
  },
  {
    id: 'oll',
    title: 'Phase 2: Orient the Top Layer (OLL)',
    badge: 'Step 2: Top Orientation',
    description:
      'Orient the top-layer corners so the entire top face shows the solved top color (e.g. White or Yellow).',
    tip: 'Observe which top stickers face sideways versus upwards.',
  },
  {
    id: 'pll',
    title: 'Phase 3: Permute the Top Layer (PLL)',
    badge: 'Step 3: Corner Permutation',
    description:
      'Swap adjacent or diagonal top corners to match all side faces and complete the cube.',
    tip: 'Look for any matching "headlights" on the side faces of the top layer.',
  },
];

/**
 * Categorizes a move sequence into educational beginner phases
 */
export function annotateBeginnerPhases(moves) {
  if (!moves || moves.length === 0) return [];

  const total = moves.length;
  // Divide moves proportionally into 3 instructional phases
  const p1End = Math.max(1, Math.round(total * 0.4));
  const p2End = Math.max(p1End + 1, Math.round(total * 0.75));

  return moves.map((move, index) => {
    let phaseIndex = 0;
    if (index >= p2End && index < total) {
      phaseIndex = 2;
    } else if (index >= p1End) {
      phaseIndex = 1;
    }
    const phase = BEGINNER_PHASES[phaseIndex];
    return {
      move,
      index,
      phaseId: phase.id,
      phaseTitle: phase.title,
      phaseBadge: phase.badge,
      phaseDescription: phase.description,
      isPhaseStart: index === 0 || (index === p1End && phaseIndex === 1) || (index === p2End && phaseIndex === 2),
    };
  });
}
