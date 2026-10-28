import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  CORNER_STICKERS,
  CORNER_HOME_COORDS,
  STICKER_FACE_OF_SLOT,
  COLORS,
} from '../core/constants.js';

/* ─────────────────────────────────────────────────────────────────────────────
 * Public geometry contract (do not change these values — the Node harness and
 * the UI both depend on them).
 * ────────────────────────────────────────────────────────────────────────── */
export const CUBIE_OFFSET = 0.52;
export const CUBIE_SIZE = 0.98;
export const STICKER_SIZE = 0.84;
export const STICKER_OFFSET = 0.5;

/* ── Studio tuning ───────────────────────────────────────────────────────────── */

// Rounded dark-plastic body: a soft bevel reads like injection-moulded ABS.
const CORE_BEVEL_RADIUS = 0.075;
const CORE_BEVEL_SEGMENTS = 6;

// Vinyl decal: rounded square, extruded to a thin raised sticker with a micro-bevel
// so the printed edge catches a highlight instead of reading as a flat plane.
const STICKER_CORNER_RADIUS = 0.105;
const STICKER_DEPTH = 0.012;
const STICKER_BEVEL = 0.004;
const STICKER_CURVE_SEGMENTS = 8;

// Derived: printed face at STICKER_OFFSET (0.5) vs. plastic surface at CUBIE_SIZE/2
// (0.49) → 0.01 proud; the 0.02-thick decal (depth + 2 × bevel) then sinks 0.01 into
// the body, which is what produces the realistic seam/step you see on a real cube.
const FACE_NORMALS = {
  0: new THREE.Vector3(0, 1, 0),
  1: new THREE.Vector3(1, 0, 0),
  2: new THREE.Vector3(0, 0, 1),
  3: new THREE.Vector3(0, -1, 0),
  4: new THREE.Vector3(-1, 0, 0),
  5: new THREE.Vector3(0, 0, -1),
};

const CORNER_BY_COORDS = new Map(
  CORNER_HOME_COORDS.map((coords, index) => [coords.join(','), index])
);

/* ─────────────────────────────────────────────────────────────────────────────
 * Geometry — built at module scope, but purely CPU-side (no GL context, no DOM),
 * so this module stays importable under plain Node.
 * ────────────────────────────────────────────────────────────────────────── */

const coreGeometry = new RoundedBoxGeometry(
  CUBIE_SIZE,
  CUBIE_SIZE,
  CUBIE_SIZE,
  CORE_BEVEL_SEGMENTS,
  CORE_BEVEL_RADIUS
);
coreGeometry.computeBoundingSphere();

/** Rounded-square outline (quadratic-free: true circular arcs). */
function createRoundedSquareShape(size, radius) {
  const half = size / 2;
  const r = Math.min(radius, half);
  const shape = new THREE.Shape();
  shape.moveTo(-half + r, -half);
  shape.lineTo(half - r, -half);
  shape.absarc(half - r, -half + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(half, half - r);
  shape.absarc(half - r, half - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-half + r, half);
  shape.absarc(-half + r, half - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-half, -half + r);
  shape.absarc(-half + r, -half + r, r, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function createStickerGeometry() {
  const geometry = new THREE.ExtrudeGeometry(
    createRoundedSquareShape(STICKER_SIZE, STICKER_CORNER_RADIUS),
    {
      curveSegments: STICKER_CURVE_SEGMENTS,
      steps: 1,
      depth: STICKER_DEPTH,
      bevelEnabled: true,
      bevelThickness: STICKER_BEVEL,
      bevelSize: STICKER_BEVEL,
      bevelOffset: 0,
      bevelSegments: 3,
    }
  );
  // The raw extrusion spans z ∈ [-bevelThickness, depth + bevelThickness] (verified:
  // [-0.004, 0.016] for our values). Shift it so the printed front face lands on z = 0
  // and the decal occupies z ∈ [-0.02, 0] — a 0.02-thick raised sticker.
  geometry.translate(0, 0, -(STICKER_DEPTH + STICKER_BEVEL));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

const stickerGeometry = createStickerGeometry();

/* ─────────────────────────────────────────────────────────────────────────────
 * Materials — premium, but GL-free at creation time.
 * ────────────────────────────────────────────────────────────────────────── */

// Dark satin plastic: slightly metallic-free body with a low-sheen clearcoat so the
// seams between cubies pick up soft environment reflections.
const coreMaterial = new THREE.MeshPhysicalMaterial({
  color: '#0b0e14',
  roughness: 0.38,
  metalness: 0.0,
  clearcoat: 0.6,
  clearcoatRoughness: 0.35,
  sheen: 0.12,
  sheenRoughness: 0.6,
  sheenColor: new THREE.Color('#6d7f96'),
  ior: 1.48,
  specularIntensity: 0.6,
  envMapIntensity: 0.8,
});

/**
 * Glossy vinyl sticker. One material instance per sticker is required: sticker
 * recolouring mutates `material.color` on individual stickers.
 */
function createStickerMaterial(face) {
  return new THREE.MeshPhysicalMaterial({
    color: COLORS[face],
    roughness: 0.24,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.12,
    // Just enough sheen to soften the colour at grazing angles without the milky
    // wash a strong sheen gives on saturated vinyl.
    sheen: 0.1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#eef4ff'),
    ior: 1.5,
    reflectivity: 0.55,
    specularIntensity: 1.0,
    envMapIntensity: 1.0,
  });
}

const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpNormal = new THREE.Vector3();

/* ─────────────────────────────────────────────────────────────────────────────
 * Geometry helpers (pure maths, unchanged public semantics)
 * ────────────────────────────────────────────────────────────────────────── */

export function cornerIndexFromPosition(position) {
  const key = [Math.sign(position.x), Math.sign(position.y), Math.sign(position.z)].join(',');
  return CORNER_BY_COORDS.get(key);
}

export function faceFromNormal(normal) {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);
  if (ay >= ax && ay >= az) return normal.y > 0 ? 0 : 3;
  if (ax >= az) return normal.x > 0 ? 1 : 4;
  return normal.z > 0 ? 2 : 5;
}

export function slotIndexFor(cornerIndex, face) {
  return CORNER_STICKERS[cornerIndex].find((slot) => STICKER_FACE_OF_SLOT[slot] === face);
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Construction
 * ────────────────────────────────────────────────────────────────────────── */

function createSticker(face) {
  const sticker = new THREE.Mesh(stickerGeometry, createStickerMaterial(face));
  const normal = FACE_NORMALS[face];
  // The decal geometry's printed face sits on z = 0 and the back on z = -thickness,
  // so translating it `STICKER_OFFSET` along the face normal puts the printed surface
  // on the 0.5 plane (0.01 proud of the plastic at CUBIE_SIZE/2) and buries the back
  // 0.01 inside the body — i.e. a raised decal with a real seam, no floating planes.
  sticker.position.copy(normal).multiplyScalar(STICKER_OFFSET);
  sticker.lookAt(normal.x * 2, normal.y * 2, normal.z * 2);
  sticker.castShadow = false; // the body already casts the silhouette shadow
  sticker.receiveShadow = false;
  sticker.name = `sticker-${face}`;
  sticker.userData.normal = normal.clone();
  sticker.userData.colorId = face;
  return sticker;
}

export function createCubie(homeCornerIndex) {
  const [cx, cy, cz] = CORNER_HOME_COORDS[homeCornerIndex];
  const cubie = new THREE.Group();
  cubie.position.set(cx * CUBIE_OFFSET, cy * CUBIE_OFFSET, cz * CUBIE_OFFSET);
  cubie.userData.homeCornerIndex = homeCornerIndex;
  cubie.name = `cubie-${homeCornerIndex}`;

  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.name = 'core';
  core.castShadow = true;
  core.receiveShadow = true;
  cubie.add(core);

  for (const slot of CORNER_STICKERS[homeCornerIndex]) {
    cubie.add(createSticker(STICKER_FACE_OF_SLOT[slot]));
  }
  return cubie;
}

export function createCubies() {
  return Array.from({ length: 8 }, (_, i) => createCubie(i));
}

/* ─────────────────────────────────────────────────────────────────────────────
 * State <-> stickers
 * ────────────────────────────────────────────────────────────────────────── */

function forEachSticker(cubies, callback) {
  for (const cubie of cubies) {
    cubie.updateWorldMatrix(true, false);
    cubie.getWorldPosition(tmpPosition);
    cubie.getWorldQuaternion(tmpQuaternion);
    const cornerIndex = cornerIndexFromPosition(tmpPosition);
    for (const child of cubie.children) {
      if (!child.userData.normal) continue;
      tmpNormal.copy(child.userData.normal).applyQuaternion(tmpQuaternion);
      const face = faceFromNormal(tmpNormal);
      callback(child, slotIndexFor(cornerIndex, face));
    }
  }
}

export function extractState(cubies) {
  const state = new Array(24);
  forEachSticker(cubies, (sticker, slot) => {
    state[slot] = sticker.userData.colorId;
  });
  return state;
}

export function applyStateToCubies(cubies, state) {
  forEachSticker(cubies, (sticker, slot) => {
    const colorId = state[slot];
    sticker.userData.colorId = colorId;
    const colorHex = COLORS[colorId] ?? '#2b2d35';
    sticker.material.color.set(colorHex);
  });
}

/**
 * Releases the GPU resources owned *per cubie* (the individual sticker materials).
 * The shared module-level geometry/material singletons are intentionally kept alive
 * so a CubeScene can be disposed and re-created (React StrictMode remounts).
 */
export function disposeCubies(cubies) {
  for (const cubie of cubies) {
    for (const child of cubie.children) {
      if (!child.userData.normal) continue;
      child.material?.dispose();
    }
  }
}

/** Shared geometry, exposed for tooling/tests; never disposed by a scene. */
export const sharedGeometry = Object.freeze({
  core: coreGeometry,
  sticker: stickerGeometry,
});
