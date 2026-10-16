import { MOVES } from '../core/constants.js';
import { MOVE_PERMUTATIONS, isSolved, stateHash } from '../core/CubeState.js';
import { getHeuristic } from './heuristics.js';

const STATE_SIZE = 24;

export const ALGORITHM_LABELS = {
  astar: 'A*',
  ida: 'IDA*',
  greedy: 'Greedy Best-First',
};

export const ALGORITHMS = Object.keys(ALGORITHM_LABELS);

function toUint8State(state) {
  return state instanceof Uint8Array ? state : Uint8Array.from(state);
}

function applyMoveFast(state, perm) {
  const next = new Uint8Array(STATE_SIZE);
  for (let i = 0; i < STATE_SIZE; i++) next[i] = state[perm[i]];
  return next;
}

function reconstructMoves(node) {
  const moves = [];
  for (let current = node; current && current.moveFromParent !== null; current = current.parent) {
    moves.push(current.moveFromParent);
  }
  return moves.reverse();
}

function isOnCurrentPath(node, id) {
  for (let current = node; current; current = current.parent) {
    if (current.id === id) return true;
  }
  return false;
}

function priorityCompare(a, b) {
  return a.priority - b.priority || b.h - a.h || a.g - b.g;
}

class MinHeap {
  constructor(compare) {
    this.compare = compare;
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(items[i], items[parent]) >= 0) break;
      [items[i], items[parent]] = [items[parent], items[i]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let smallest = i;
        if (l < items.length && this.compare(items[l], items[smallest]) < 0) smallest = l;
        if (r < items.length && this.compare(items[r], items[smallest]) < 0) smallest = r;
        if (smallest === i) break;
        [items[i], items[smallest]] = [items[smallest], items[i]];
        i = smallest;
      }
    }
    return top;
  }

  peekTop(k) {
    const items = this.items;
    const result = [];
    if (items.length === 0) return result;
    const candidates = [{ item: items[0], index: 0 }];
    while (result.length < k && candidates.length > 0) {
      let best = 0;
      for (let i = 1; i < candidates.length; i++) {
        if (this.compare(candidates[i].item, candidates[best].item) < 0) best = i;
      }
      const { item, index } = candidates.splice(best, 1)[0];
      result.push(item);
      const l = 2 * index + 1;
      const r = l + 1;
      if (l < items.length) candidates.push({ item: items[l], index: l });
      if (r < items.length) candidates.push({ item: items[r], index: r });
    }
    return result;
  }
}

function makeNode(state, id, parent, moveFromParent, g, h, priority) {
  return { id, state, parent, moveFromParent, g, h, priority };
}

function buildFrame(step, algorithmId, node, open, closedCount, isGoal) {
  return {
    step,
    algorithm: ALGORITHM_LABELS[algorithmId],
    currentNode: {
      id: node.id,
      parentId: node.parent ? node.parent.id : null,
      moveFromParent: node.moveFromParent,
      path: reconstructMoves(node),
      state: Array.from(node.state),
      g: node.g,
      h: node.h,
      f: node.g + node.h,
    },
    openSetCount: open.size,
    closedSetCount: closedCount,
    openTopNodes: open.peekTop(5).map((n) => ({
      id: n.id,
      move: n.moveFromParent,
      g: n.g,
      h: n.h,
      f: n.g + n.h,
    })),
    isGoal,
  };
}

function buildIdaFrame(step, node, stack, closedCount, isGoal) {
  return {
    step,
    algorithm: ALGORITHM_LABELS.ida,
    currentNode: {
      id: node.id,
      parentId: node.parent ? node.parent.id : null,
      moveFromParent: node.moveFromParent,
      path: reconstructMoves(node),
      state: Array.from(node.state),
      g: node.g,
      h: node.h,
      f: node.g + node.h,
    },
    openSetCount: stack.length,
    closedSetCount: closedCount,
    openTopNodes: [...stack]
      .sort(priorityCompare)
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        move: n.moveFromParent,
        g: n.g,
        h: n.h,
        f: n.g + n.h,
      })),
    isGoal,
  };
}

function buildResult(node, algorithmId, heuristicId, nodesExpanded, truncated = false) {
  return {
    solution: node ? reconstructMoves(node) : null,
    solutionLength: node ? node.g : null,
    nodesExpanded,
    algorithm: ALGORITHM_LABELS[algorithmId],
    heuristic: heuristicId,
    truncated,
  };
}

export function* search(startState, options = {}) {
  const {
    algorithm = 'astar',
    heuristic = 'h2',
    maxNodes = 2_000_000,
    yieldEvery = 1,
  } = options;

  const hFn = getHeuristic(heuristic);
  const start = toUint8State(startState);
  const root = makeNode(start, stateHash(start), null, null, 0, hFn(start), hFn(start));

  if (algorithm === 'greedy') {
    return yield* runGreedy(root, hFn, maxNodes, yieldEvery, heuristic);
  }
  if (algorithm === 'ida') {
    return yield* runIda(root, hFn, maxNodes, yieldEvery, heuristic);
  }
  if (algorithm === 'astar') {
    return yield* runAstar(root, hFn, maxNodes, yieldEvery, heuristic);
  }
  throw new Error(`Unknown algorithm: ${algorithm}`);
}

function* runAstar(root, hFn, maxNodes, yieldEvery, heuristicId) {
  const open = new MinHeap(priorityCompare);
  open.push(root);
  const gScore = new Map([[root.id, 0]]);
  const closed = new Set();
  let expanded = 0;
  let step = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const current = open.pop();
    if (closed.has(current.id) || gScore.get(current.id) !== current.g) continue;
    closed.add(current.id);
    expanded++;
    const goal = isSolved(current.state);
    if (goal || expanded % yieldEvery === 0) {
      yield buildFrame(step++, 'astar', current, open, closed.size, goal);
    }
    if (goal) return buildResult(current, 'astar', heuristicId, expanded);
    for (const move of MOVES) {
      const nextState = applyMoveFast(current.state, MOVE_PERMUTATIONS[move]);
      const id = stateHash(nextState);
      const g = current.g + 1;
      const known = gScore.get(id);
      if (known !== undefined && known <= g) continue;
      gScore.set(id, g);
      const h = hFn(nextState);
      open.push(makeNode(nextState, id, current, move, g, h, g + h));
    }
  }
  return buildResult(null, 'astar', heuristicId, expanded, true);
}

function* runGreedy(root, hFn, maxNodes, yieldEvery, heuristicId) {
  const open = new MinHeap(priorityCompare);
  open.push(root);
  const closed = new Set();
  let expanded = 0;
  let step = 0;

  while (open.size > 0 && expanded < maxNodes) {
    const current = open.pop();
    if (closed.has(current.id)) continue;
    closed.add(current.id);
    expanded++;
    const goal = isSolved(current.state);
    if (goal || expanded % yieldEvery === 0) {
      yield buildFrame(step++, 'greedy', current, open, closed.size, goal);
    }
    if (goal) return buildResult(current, 'greedy', heuristicId, expanded);
    for (const move of MOVES) {
      const nextState = applyMoveFast(current.state, MOVE_PERMUTATIONS[move]);
      const id = stateHash(nextState);
      if (closed.has(id)) continue;
      const h = hFn(nextState);
      open.push(makeNode(nextState, id, current, move, current.g + 1, h, h));
    }
  }
  return buildResult(null, 'greedy', heuristicId, expanded, true);
}

function* runIda(root, hFn, maxNodes, yieldEvery, heuristicId) {
  let threshold = root.h;
  let expanded = 0;
  let step = 0;

  for (;;) {
    let minExceeded = Infinity;
    const stack = [root];
    while (stack.length > 0 && expanded < maxNodes) {
      const node = stack.pop();
      const f = node.g + node.h;
      if (f > threshold) {
        if (f < minExceeded) minExceeded = f;
        continue;
      }
      const goal = isSolved(node.state);
      if (goal) {
        yield buildIdaFrame(step++, node, stack, expanded + 1, true);
        return buildResult(node, 'ida', heuristicId, expanded + 1);
      }
      expanded++;
      if (expanded % yieldEvery === 0) {
        yield buildIdaFrame(step++, node, stack, expanded, false);
      }
      for (const move of MOVES) {
        const nextState = applyMoveFast(node.state, MOVE_PERMUTATIONS[move]);
        const id = stateHash(nextState);
        if (isOnCurrentPath(node, id)) continue;
        const g = node.g + 1;
        const h = hFn(nextState);
        const child = makeNode(nextState, id, node, move, g, h, g + h);
        const cf = g + h;
        if (cf > threshold) {
          if (cf < minExceeded) minExceeded = cf;
          continue;
        }
        stack.push(child);
      }
    }
    if (expanded >= maxNodes) return buildResult(null, 'ida', heuristicId, expanded, true);
    if (minExceeded === Infinity) return buildResult(null, 'ida', heuristicId, expanded, true);
    threshold = minExceeded;
  }
}

export function runSearch(startState, options = {}) {
  const collectFrames = options.collectFrames !== false;
  const iterator = search(startState, options);
  const frames = [];
  for (;;) {
    const { value, done } = iterator.next();
    if (done) return { result: value, frames };
    if (collectFrames) frames.push(value);
  }
}
