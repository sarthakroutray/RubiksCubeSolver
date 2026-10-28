import { search } from '../../solver/SearchEngine.js';

export class SolveSession {
  constructor() {
    this.worker = null;
    this.aborted = false;
  }

  async run(startState, options = {}, onFrame = null) {
    this.aborted = false;
    const {
      algorithm = 'astar',
      heuristic = 'h2',
      maxNodes = 1_500_000,
      yieldEvery = 1,
    } = options;

    // Check if Web Worker is supported in current environment
    const hasWorker =
      typeof window !== 'undefined' && typeof window.Worker !== 'undefined';

    if (hasWorker) {
      return new Promise((resolve, reject) => {
        try {
          this.worker = new Worker(
            new URL('./solveWorker.js', import.meta.url),
            { type: 'module' }
          );

          this.worker.onmessage = (e) => {
            const data = e.data;
            if (!data) return;

            if (data.type === 'FRAME') {
              if (!this.aborted && typeof onFrame === 'function') {
                onFrame(data.frame);
              }
            } else if (data.type === 'DONE') {
              this.cleanup();
              resolve(data.result);
            } else if (data.type === 'CANCELLED') {
              this.cleanup();
              resolve({ cancelled: true });
            } else if (data.type === 'ERROR') {
              this.cleanup();
              reject(new Error(data.error));
            }
          };

          this.worker.onerror = (err) => {
            this.cleanup();
            // Fallback to inline generator if worker instantiation failed
            this.runInline(startState, options, onFrame).then(resolve, reject);
          };

          this.worker.postMessage({
            type: 'START',
            startState,
            algorithm,
            heuristic,
            maxNodes,
            yieldEvery,
          });
        } catch (workerErr) {
          // Fallback to inline
          this.runInline(startState, options, onFrame).then(resolve, reject);
        }
      });
    }

    // Direct inline fallback
    return this.runInline(startState, options, onFrame);
  }

  async runInline(startState, options = {}, onFrame = null) {
    const {
      algorithm = 'astar',
      heuristic = 'h2',
      maxNodes = 1_500_000,
      yieldEvery = 1,
    } = options;

    let frameCount = 0;
    const started = performance.now();
    const iterator = search(startState, {
      algorithm,
      heuristic,
      maxNodes,
      yieldEvery,
    });

    for (;;) {
      if (this.aborted) {
        return { cancelled: true };
      }

      const { value, done } = iterator.next();
      if (done) {
        value.elapsedMs = Math.round(performance.now() - started);
        return value;
      }

      if (typeof onFrame === 'function') {
        onFrame(value);
      }

      frameCount++;
      if (frameCount % 25 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }

  abort() {
    this.aborted = true;
    if (this.worker) {
      try {
        this.worker.postMessage({ type: 'STOP' });
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
  }

  cleanup() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch {}
      this.worker = null;
    }
  }
}
