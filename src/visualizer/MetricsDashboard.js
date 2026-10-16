const CARDS = [
  ['expanded', 'Expanded Nodes', 'Closed List |Closed|', 'accent-blue', 'Total states popped and evaluated from the frontier'],
  ['frontier', 'Frontier Size',  'Open Priority Queue',  'accent-cyan', 'States generated and waiting for evaluation'],
  ['g',        'Search Depth',   'Path Cost g(n)',       'accent-amber', 'Actual number of moves from initial state'],
  ['h',        'Heuristic Est.', 'Future Cost h(n)',     'accent-purple', 'Admissible lower-bound estimate to goal'],
  ['f',        'Evaluation f(n)','Total Cost g + h',     'accent-indigo', 'Priority rank used to order node expansions'],
  ['bf',       'Effective b*',   'Branching Factor',     'accent-emerald', 'Effective branching factor b* = (Nodes)^(1/depth)'],
];

export function computeBranchingFactor(nodesExpanded, depth) {
  if (!depth || depth < 1 || !nodesExpanded || nodesExpanded < 1) return '—';
  return Math.pow(nodesExpanded, 1 / depth).toFixed(2);
}

export class MetricsDashboard {
  constructor(container) {
    container.innerHTML = CARDS.map(
      ([key, label, code, accent, tooltip]) => `
      <div class="metric-card ${accent}" title="${tooltip}">
        <div class="metric-top">
          <span class="metric-label">${label}</span>
          <span class="metric-code">${code}</span>
        </div>
        <span class="metric-value" data-metric="${key}">0</span>
      </div>`
    ).join('');

    this.cards = {};
    for (const [key] of CARDS) {
      this.cards[key] = container.querySelector(`[data-metric="${key}"]`);
    }
  }

  reset() {
    for (const card of Object.values(this.cards)) card.textContent = '0';
    this.cards.bf.textContent = '—';
  }

  update(frame, extra = {}) {
    const { currentNode } = frame;
    this.cards.expanded.textContent = frame.closedSetCount.toLocaleString();
    this.cards.frontier.textContent = frame.openSetCount.toLocaleString();
    this.cards.g.textContent = currentNode.g;
    this.cards.h.textContent = currentNode.h.toFixed(2);
    this.cards.f.textContent = currentNode.f.toFixed(2);
    if (extra.branchingFactor !== undefined) {
      this.cards.bf.textContent = extra.branchingFactor;
    }
  }

  updateFromResult(result) {
    this.cards.expanded.textContent = result.nodesExpanded.toLocaleString();
    this.cards.g.textContent = result.solutionLength ?? '—';
    this.cards.bf.textContent = result.solutionLength
      ? computeBranchingFactor(result.nodesExpanded, result.solutionLength)
      : '—';
  }
}
