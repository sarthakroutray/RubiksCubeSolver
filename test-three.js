import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCubies, extractState, applyStateToCubies } from './src/three/CubieMesh.js';
import { MoveAnimator } from './src/three/MoveAnimator.js';
import {
  solvedState,
  applyMove,
  isSolved,
  scramble,
  stateHash,
} from './src/core/CubeState.js';
import { MOVES } from './src/core/constants.js';

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log(`  PASS  ${name}`);
}

function makeRig() {
  const scene = new THREE.Scene();
  const cubies = createCubies();
  for (const cubie of cubies) scene.add(cubie);
  return { scene, cubies, animator: new MoveAnimator(scene, cubies) };
}

function assertSameState(actual, expected, context) {
  assert.equal(stateHash(actual), stateHash(expected), `${context}: ${stateHash(actual)} != ${stateHash(expected)}`);
}

function assertNoDrift(cubies, context) {
  const matrix = new THREE.Matrix4();
  for (const cubie of cubies) {
    for (const axis of ['x', 'y', 'z']) {
      const value = cubie.position[axis];
      assert.equal(value, Math.round(value * 100) / 100, `${context}: position drifted`);
      assert.ok(Math.abs(Math.abs(value) - 0.52) < 1e-9, `${context}: ${axis}=${value} off grid`);
    }
    cubie.updateMatrix();
    matrix.copy(cubie.matrix);
    const e = matrix.elements;
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        const v = e[col * 4 + row];
        const snapped = Math.round(v);
        assert.ok(Math.abs(v - snapped) < 1e-9, `${context}: rotation matrix drifted (${v})`);
        assert.ok(snapped === 0 || Math.abs(snapped) === 1, `${context}: rotation not orthogonal`);
      }
    }
  }
}

console.log('Verification Gate 3 — Three.js MoveAnimator vs CubeState consistency');

check('freshly built cubies match the solved CubeState', () => {
  const { cubies } = makeRig();
  assertSameState(extractState(cubies), solvedState(), 'initial');
});

check('every move executed by the 3D MoveAnimator matches CubeState.js exactly', () => {
  for (const move of MOVES) {
    const { scene, cubies, animator } = makeRig();
    animator.applyInstant(move);
    const expected = applyMove(solvedState(), move);
    assertSameState(extractState(cubies), expected, `move ${move}`);
    assertNoDrift(cubies, `move ${move}`);
    scene.clear();
  }
});

check('a 40-move animated sequence stays in lockstep with CubeState.js at every step', () => {
  const { cubies, animator } = makeRig();
  let expected = solvedState();
  let seed = 20261016;
  const nextRandom = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  let lastFace = null;
  for (let i = 0; i < 40; i++) {
    const candidates = MOVES.filter((m) => m[0] !== lastFace);
    const move = candidates[Math.floor(nextRandom() * candidates.length)];
    lastFace = move[0];
    animator.applyInstant(move);
    expected = applyMove(expected, move);
    assertSameState(extractState(cubies), expected, `step ${i} (${move})`);
  }
  assertNoDrift(cubies, '40-move sequence');
});

check('syncToStateArray snaps sticker colors to any node state and stays consistent under moves', () => {
  const { cubies, animator } = makeRig();
  const { state: ghostState, scrambleMoves } = scramble(7);
  applyStateToCubies(cubies, ghostState);
  assertSameState(extractState(cubies), ghostState, 'ghost sync');

  let expected = ghostState;
  for (const move of ['U', 'R', 'F', "U'", "R'", "F'", 'U2', 'R2', 'F2']) {
    animator.applyInstant(move);
    expected = applyMove(expected, move);
    assertSameState(extractState(cubies), expected, `ghost + ${move}`);
  }
  assert.ok(scrambleMoves.length === 7);
});

check('scramble-then-solve cycle returns the 3D cube to the solved visual state', () => {
  const { cubies, animator } = makeRig();
  const { state, scrambleMoves } = scramble(8);
  applyStateToCubies(cubies, state);
  const restore = [];
  for (const move of scrambleMoves) {
    restore.unshift(move.endsWith('2') ? move : move.endsWith("'") ? move[0] : `${move[0]}'`);
  }
  let model = state;
  for (const move of restore) {
    animator.applyInstant(move);
    model = applyMove(model, move);
  }
  assertSameState(extractState(cubies), model, 'restore');
  assert.ok(isSolved(model), 'inverse sequence must solve');
});

check('animator queue drains in order and reports busy state (async animation path)', () => {
  const { cubies, animator } = makeRig();
  let expected = solvedState();
  for (const move of ['U', 'R', "F'"]) {
    expected = applyMove(expected, move);
    animator.queueMove(move, 5);
  }
  assert.equal(animator.busy, true);
  for (let i = 0; i < 60; i++) animator.update(5);
  assert.equal(animator.busy, false);
  assertSameState(extractState(cubies), expected, 'queued playback');
  assertNoDrift(cubies, 'queued playback');
});

console.log(`\nGate 3 passed: ${passed} checks.`);
