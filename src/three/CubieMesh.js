import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  CORNER_STICKERS,
  CORNER_HOME_COORDS,
  STICKER_FACE_OF_SLOT,
  COLORS,
} from '../core/constants.js';

export const CUBIE_OFFSET = 0.52;
export const CUBIE_SIZE = 0.98;
export const STICKER_SIZE = 0.84;
export const STICKER_OFFSET = 0.5;

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

const coreGeometry = new RoundedBoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE, 4, 0.08);
const stickerGeometry = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
const coreMaterial = new THREE.MeshStandardMaterial({
  color: '#0d1117',
  roughness: 0.75,
  metalness: 0.1,
});

const tmpPosition = new THREE.Vector3();
const tmpQuaternion = new THREE.Quaternion();
const tmpNormal = new THREE.Vector3();

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

function createSticker(face) {
  const material = new THREE.MeshStandardMaterial({
    color: COLORS[face],
    roughness: 0.32,
    metalness: 0.04,
  });
  const sticker = new THREE.Mesh(stickerGeometry, material);
  const normal = FACE_NORMALS[face];
  sticker.position.copy(normal).multiplyScalar(STICKER_OFFSET);
  sticker.lookAt(normal.x * 2, normal.y * 2, normal.z * 2);
  sticker.userData.normal = normal.clone();
  sticker.userData.colorId = face;
  return sticker;
}

export function createCubie(homeCornerIndex) {
  const [cx, cy, cz] = CORNER_HOME_COORDS[homeCornerIndex];
  const cubie = new THREE.Group();
  cubie.position.set(cx * CUBIE_OFFSET, cy * CUBIE_OFFSET, cz * CUBIE_OFFSET);
  cubie.userData.homeCornerIndex = homeCornerIndex;
  cubie.add(new THREE.Mesh(coreGeometry, coreMaterial));
  for (const slot of CORNER_STICKERS[homeCornerIndex]) {
    cubie.add(createSticker(STICKER_FACE_OF_SLOT[slot]));
  }
  return cubie;
}

export function createCubies() {
  return Array.from({ length: 8 }, (_, i) => createCubie(i));
}

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
    sticker.userData.colorId = state[slot];
    sticker.material.color.set(COLORS[state[slot]]);
  });
}
