import * as THREE from 'three';

/**
 * Pivot-group face animator.
 *
 * A move is executed by (1) re-parenting the 4 cubies of the turning layer into a
 * temporary pivot group via `attach()` — which preserves their world transforms —
 * (2) easing `pivot.rotation[axis]` to the target quarter turn, and (3) attaching the
 * cubies back and snapping position/rotation to the exact lattice so that no
 * floating-point drift ever accumulates (a strict requirement of the test harness).
 */

const MOVE_CONFIG = {
  U: { axis: 'y', inLayer: (p) => p.y > 0.1 },
  R: { axis: 'x', inLayer: (p) => p.x > 0.1 },
  F: { axis: 'z', inLayer: (p) => p.z > 0.1 },
};

const QUARTER_TURN = -Math.PI / 2;
const SNAP = Math.PI / 2;

const VALID_MOVE = /^[URF](2|')?$/;

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function turnsFor(move) {
  if (move.endsWith('2')) return 2;
  if (move.endsWith("'")) return 3;
  return 1;
}

function snapAngle(value) {
  return Math.round(value / SNAP) * SNAP;
}

function assertMove(move) {
  if (typeof move !== 'string' || !VALID_MOVE.test(move)) {
    throw new Error(`Unknown move: ${move}`);
  }
}

export class MoveAnimator {
  constructor(scene, cubies) {
    this.scene = scene;
    this.cubies = cubies;
    this.queue = [];
    this.current = null;
  }

  get busy() {
    return this.current !== null || this.queue.length > 0;
  }

  queueMove(move, durationMs = 320) {
    assertMove(move);
    return new Promise((resolve) => {
      this.queue.push({ move, durationMs, resolve });
    });
  }

  applyInstant(move) {
    const built = this.buildPivot(move);
    built.pivot.rotation[built.axis] = built.targetAngle;
    this.release(built);
  }

  /**
   * Stops all playback immediately, leaving the cube in its fully rotated final
   * state and resolving every promise (so `await`ing callers never hang on unmount).
   */
  cancelAll() {
    if (this.current !== null) {
      const anim = this.current;
      anim.pivot.rotation[anim.axis] = anim.targetAngle;
      this.release(anim);
      this.current = null;
      anim.resolve();
    }
    while (this.queue.length > 0) this.queue.shift().resolve();
  }

  update(deltaMs) {
    // Guard against NaN/negative deltas (tab switches, clock hiccups).
    const step = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;

    if (this.current === null && this.queue.length > 0) {
      const item = this.queue.shift();
      this.current = { ...this.buildPivot(item.move), ...item, elapsed: 0 };
    }
    if (this.current === null) return;

    const anim = this.current;
    anim.elapsed += step;
    const progress = Math.min(1, anim.elapsed / anim.durationMs);
    anim.pivot.rotation[anim.axis] = anim.targetAngle * easeInOutCubic(progress);

    if (progress >= 1) {
      this.release(anim);
      this.current = null;
      anim.resolve();
    }
  }

  buildPivot(move) {
    const config = MOVE_CONFIG[move[0]];
    if (!config) throw new Error(`Unknown move: ${move}`);
    const pivot = new THREE.Group();
    this.scene.add(pivot);
    const layer = this.cubies.filter((cubie) => config.inLayer(cubie.position));
    for (const cubie of layer) pivot.attach(cubie);
    return {
      pivot,
      layer,
      axis: config.axis,
      targetAngle: QUARTER_TURN * turnsFor(move),
    };
  }

  release(built) {
    for (const cubie of built.layer) {
      this.scene.attach(cubie);
      cubie.position.set(
        Math.round(cubie.position.x * 100) / 100,
        Math.round(cubie.position.y * 100) / 100,
        Math.round(cubie.position.z * 100) / 100
      );
      cubie.rotation.set(
        snapAngle(cubie.rotation.x),
        snapAngle(cubie.rotation.y),
        snapAngle(cubie.rotation.z)
      );
      cubie.updateMatrix();
    }
    this.scene.remove(built.pivot);
  }
}
