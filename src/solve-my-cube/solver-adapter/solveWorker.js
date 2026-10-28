import { search } from '../../solver/SearchEngine.js';

let isCancelled = false;

self.onmessage = function (e) {
  const data = e.data;
  if (!data) return;

  if (data.type === 'STOP') {
    isCancelled = true;
    return;
  }

  if (data.type === 'START') {
    isCancelled = false;
    const { startState, algorithm = 'astar', heuristic = 'h2', maxNodes = 1_500_000, yieldEvery = 25 } = data;
    const started = performance.now();

    try {
      const iterator = search(startState, {
        algorithm,
        heuristic,
        maxNodes,
        yieldEvery,
      });

      for (;;) {
        if (isCancelled) {
          self.postMessage({ type: 'CANCELLED' });
          return;
        }

        const { value, done } = iterator.next();

        if (done) {
          const elapsed = Math.round(performance.now() - started);
          value.elapsedMs = elapsed;
          self.postMessage({ type: 'DONE', result: value });
          return;
        }

        self.postMessage({ type: 'FRAME', frame: value });
      }
    } catch (err) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }
  }
};
