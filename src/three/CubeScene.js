import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  createCubies,
  applyStateToCubies,
  extractState,
  disposeCubies,
  cornerIndexFromPosition,
  faceFromNormal,
  slotIndexFor,
} from './CubieMesh.js';
import { MoveAnimator } from './MoveAnimator.js';

/* ─────────────────────────────────────────────────────────────────────────────
 * Studio configuration
 * NOTE: everything WebGL/DOM related (renderer, PMREM, RoomEnvironment, canvas,
 * ResizeObserver) is created lazily inside the constructor. This module therefore
 * stays importable — and safe to SSR-import — under plain Node.
 * ────────────────────────────────────────────────────────────────────────── */

const CAMERA_FOV = 42;
const CAMERA_NEAR = 0.1;
const CAMERA_FAR = 100;

// Same presets as before (iso / front / top / right), re-framed so the cube fills the
// viewport the way a product render would, with a little headroom for the shadow.
const CAMERA_VIEWS = {
  iso: { pos: [2.9, 2.42, 3.86], target: [0, 0, 0] },
  front: { pos: [0, 0.05, 5.4], target: [0, 0, 0] },
  top: { pos: [0, 5.4, 0.001], target: [0, 0, 0] },
  right: { pos: [5.4, 0.05, 0], target: [0, 0, 0] },
};

const FLOOR_Y = -1.05; // cube underside sits at y = -1.02
const CONTACT_SHADOW_SIZE = 2.5;
const HARDWARE_LIMITS = { minDistance: 2.6, maxDistance: 14 };

/* ── Best-effort, side-effect free helpers ─────────────────────────────────── */

/**
 * Soft radial-gradient alpha mask used for the fake contact/AO shadow under the cube.
 * Returns null when no DOM is available (SSR / Node) so callers can skip it.
 */
function createContactShadowTexture(size = 256) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0.0, 'rgba(0, 0, 0, 0.85)');
  gradient.addColorStop(0.42, 'rgba(0, 0, 0, 0.45)');
  gradient.addColorStop(0.72, 'rgba(0, 0, 0, 0.14)');
  gradient.addColorStop(1.0, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Adds an emissive "softbox" plane to the environment scene before it is baked to a
 * PMREM. Bright planar sources give the clearcoat stickers a soft studio highlight
 * sweep (instead of only the dim, flat RoomEnvironment walls) — the single biggest
 * step up in perceived realism for a glossy product shot.
 */
function addEnvironmentSoftbox(room, { position, rotation = [0, 0, 0], width, height, radiance, tint = 0xffffff }) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(tint).multiplyScalar(radiance),
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const panel = new THREE.Mesh(geometry, material);
  panel.position.set(...position);
  panel.rotation.set(...rotation);
  room.add(panel);
  return panel;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * CubeScene
 * ────────────────────────────────────────────────────────────────────────── */

export class CubeScene {
  constructor(container) {
    if (!container) throw new Error('CubeScene requires a container element');

    this.container = container;
    this.disposed = false;
    this.running = true;
    this.animationFrame = null;
    this.disposables = []; // per-scene geometries / materials / textures we own

    /* ── Renderer: linear-correct, filmic, antialiased, alpha over the CSS backdrop ── */
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      premultipliedAlpha: true,
      stencil: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearAlpha(0); // never paint an opaque background
    this.applyPixelRatio();

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.outline = 'none';
    canvas.style.touchAction = 'none';
    container.appendChild(canvas);

    /* ── Scene + image-based lighting (PMREM of RoomEnvironment) ── */
    this.scene = new THREE.Scene();
    this.scene.background = null; // CSS backdrop shows through
    this.buildEnvironment();

    /* ── Camera ── */
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, CAMERA_NEAR, CAMERA_FAR);
    this.camera.position.set(...CAMERA_VIEWS.iso.pos);

    /* ── Controls ── */
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.rotateSpeed = 0.85;
    this.controls.zoomSpeed = 0.8;
    this.controls.minDistance = HARDWARE_LIMITS.minDistance;
    this.controls.maxDistance = HARDWARE_LIMITS.maxDistance;
    this.controls.minPolarAngle = 0.08; // never fully overhead…
    this.controls.maxPolarAngle = Math.PI * 0.5 + 0.24; // …nor under the floor mat
    this.controls.target.set(...CAMERA_VIEWS.iso.target);
    this.controls.update();

    /* ── Studio light rig + ground ── */
    this.buildLights();
    this.buildFloor();

    /* ── Cube ── */
    // A single parent group at identity keeps the cubies' local coordinates identical
    // to their world coordinates (the harness asserts exact ±0.52 local positions),
    // while giving the animator a tidy pivot parent and the scene one disposal root.
    this.cubeGroup = new THREE.Group();
    this.cubeGroup.name = 'cube';
    this.scene.add(this.cubeGroup);

    this.cubies = createCubies();
    for (const cubie of this.cubies) this.cubeGroup.add(cubie);

    this.animator = new MoveAnimator(this.cubeGroup, this.cubies);

    /* ── Loop ── */
    this.clock = new THREE.Clock();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.onWindowResize = () => this.resize();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize, { passive: true });
    }
    this.resize();

    this.loop = () => {
      if (!this.running) return;
      this.animationFrame = requestAnimationFrame(this.loop);
      const deltaMs = this.clock.getDelta() * 1000;
      this.animator.update(deltaMs);
      this.controls.update();
      this.render();
    };
    this.loop();
  }

  /* ── Setup helpers ───────────────────────────────────────────────────────── */

  applyPixelRatio() {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    this.renderer.setPixelRatio(Math.min(dpr, 2));
  }

  /**
   * Image-based lighting: a PMREM-filtered RoomEnvironment gives every physical
   * material believable, view-dependent reflections (soft studio boxes overhead and
   * to the sides), which is what separates a render from flat shaded primitives.
   */
  buildEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();

    // sigma 0.04 is the largest prefilter blur the 256px default cubemap can carry
    // without emitting a "sigma too large" clamp warning in the console.
    this.environmentRT = pmrem.fromScene(room, 0.04);
    this.scene.environment = this.environmentRT.texture;
    this.scene.environmentIntensity = 0.78;

    room.dispose();
    pmrem.dispose();
    this.pmrem = null;
  }

  /** Key (shadow-casting) + fill + rim + subtle bounce. */
  buildLights() {
    // 3/4 key from the upper-left of the default camera: lights the visible faces and
    // throws a soft contact shadow toward screen-right so the cube reads as anchored.
    this.keyLight = new THREE.DirectionalLight(0xfff4e8, 1.9);
    this.keyLight.position.set(-3.8, 6.6, 4.9);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.radius = 5;
    this.keyLight.shadow.camera.near = 0.5;
    this.keyLight.shadow.camera.far = 40;
    // Wide frustum so the cast shadow never meets a hard clip edge.
    this.keyLight.shadow.camera.left = -9;
    this.keyLight.shadow.camera.right = 9;
    this.keyLight.shadow.camera.top = 9;
    this.keyLight.shadow.camera.bottom = -9;
    this.keyLight.shadow.bias = -0.0006;
    this.keyLight.shadow.normalBias = 0.03;
    this.keyLight.shadow.camera.updateProjectionMatrix();

    // Cool fill on the opposite side of the key keeps the unlit faces readable.
    this.fillLight = new THREE.DirectionalLight(0xbfd6ff, 0.45);
    this.fillLight.position.set(6.2, 2.6, 4.4);

    // Blue rim from behind separates the silhouette from the backdrop.
    this.rimLight = new THREE.DirectionalLight(0x8fbcff, 1.15);
    this.rimLight.position.set(-3.0, 5.5, -7.5);

    this.bounceLight = new THREE.DirectionalLight(0x2a3a52, 0.3);
    this.bounceLight.position.set(2.0, -6.0, 3.0);

    this.hemiLight = new THREE.HemisphereLight(0x9db6d8, 0x0a0d12, 0.24);

    this.scene.add(
      this.keyLight,
      this.keyLight.target,
      this.fillLight,
      this.rimLight,
      this.bounceLight,
      this.hemiLight
    );
  }

  /** Shadow-only floor mat + soft radial contact shadow so the cube feels grounded. */
  buildFloor() {
    this.floorMaterial = new THREE.ShadowMaterial({
      color: 0x01030a,
      opacity: 0.26,
      transparent: true,
    });
    this.floorGeometry = new THREE.PlaneGeometry(32, 32);
    this.floor = new THREE.Mesh(this.floorGeometry, this.floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = FLOOR_Y;
    this.floor.receiveShadow = true;
    this.floor.name = 'floor-shadow-catcher';
    this.scene.add(this.floor);
    this.disposables.push(this.floorGeometry, this.floorMaterial);

    const contactTexture = createContactShadowTexture();
    if (contactTexture) {
      this.contactMaterial = new THREE.MeshBasicMaterial({
        map: contactTexture,
        color: 0x000000,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        toneMapped: false,
      });
      this.contactGeometry = new THREE.PlaneGeometry(CONTACT_SHADOW_SIZE, CONTACT_SHADOW_SIZE);
      this.contactShadow = new THREE.Mesh(this.contactGeometry, this.contactMaterial);
      this.contactShadow.rotation.x = -Math.PI / 2;
      this.contactShadow.position.y = FLOOR_Y + 0.004;
      this.contactShadow.renderOrder = 1;
      this.contactShadow.name = 'contact-shadow';
      this.scene.add(this.contactShadow);
      this.disposables.push(this.contactGeometry, this.contactMaterial, contactTexture);
    }
  }

  render() {
    if (this.container.clientWidth === 0 || this.container.clientHeight === 0) return;
    this.renderer.render(this.scene, this.camera);
  }

  /* ── Public API ──────────────────────────────────────────────────────────── */

  syncToStateArray(state) {
    if (!state) return;
    applyStateToCubies(this.cubies, state);
  }

  getState() {
    return extractState(this.cubies);
  }

  queueMove(move, durationMs = 320) {
    return this.animator.queueMove(move, durationMs);
  }

  async playMoves(moves, durationMs = 320) {
    for (const move of moves) {
      await this.queueMove(move, durationMs);
    }
  }

  get busy() {
    return this.animator.busy;
  }

  setCameraView(view = 'iso') {
    const preset = CAMERA_VIEWS[view] || CAMERA_VIEWS.iso;
    this.camera.position.set(...preset.pos);
    this.controls.target.set(...preset.target);
    this.controls.update();
    return this;
  }

  resetCamera() {
    return this.setCameraView('iso');
  }

  pickStickerSlot(clientX, clientY) {
    if (!this.renderer || !this.camera || !this.cubies) return -1;
    const dom = this.renderer.domElement;
    if (!dom) return -1;
    const rect = dom.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera({ x, y }, this.camera);
    const hits = raycaster.intersectObjects(this.cubies, true);

    const tmpPos = new THREE.Vector3();
    const tmpNorm = new THREE.Vector3();

    for (const hit of hits) {
      const obj = hit.object;
      if (obj && obj.userData && obj.userData.normal && obj.parent) {
        const cubie = obj.parent;
        cubie.getWorldPosition(tmpPos);
        const cornerIndex = cornerIndexFromPosition(tmpPos);
        tmpNorm.copy(obj.userData.normal).applyQuaternion(cubie.quaternion);
        const face = faceFromNormal(tmpNorm);
        const slot = slotIndexFor(cornerIndex, face);
        if (slot !== undefined && slot >= 0) return slot;
      }
    }
    return -1;
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyPixelRatio();
    // updateStyle = false: the canvas is CSS-sized, so ResizeObserver cannot loop.
    this.renderer.setSize(width, height, false);
  }

  /* ── Teardown ────────────────────────────────────────────────────────────── */

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.running = false;

    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.onWindowResize && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
      this.onWindowResize = null;
    }

    // Resolve anything still queued so awaiting callers never hang on unmount.
    this.animator?.cancelAll();

    this.controls?.dispose();

    // Per-cubie sticker materials. The shared core geometry/material singletons live
    // in CubieMesh, so they survive a dispose → re-construct cycle (StrictMode).
    disposeCubies(this.cubies);
    this.cubies = [];

    if (this.environmentRT) {
      this.environmentRT.dispose();
      this.environmentRT = null;
    }
    if (this.scene) {
      this.scene.environment = null;
      this.scene.clear();
    }

    for (const resource of this.disposables) resource?.dispose?.();
    this.disposables = [];

    if (this.pmrem) {
      this.pmrem.dispose();
      this.pmrem = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss?.();
      this.renderer.domElement?.remove();
    }
  }
}
