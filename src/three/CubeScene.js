import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCubies, applyStateToCubies, extractState } from './CubieMesh.js';
import { MoveAnimator } from './MoveAnimator.js';

export class CubeScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(3.6, 3.0, 4.8);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 14;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(5, 8, 6);
    const fill = new THREE.DirectionalLight(0x94a3b8, 0.65);
    fill.position.set(-6, -2, -6);
    const rim = new THREE.DirectionalLight(0x60a5fa, 0.45);
    rim.position.set(0, -6, 6);
    this.scene.add(ambient, key, fill, rim);

    this.cubies = createCubies();
    for (const cubie of this.cubies) this.scene.add(cubie);

    this.animator = new MoveAnimator(this.scene, this.cubies);
    this.clock = new THREE.Clock();
    this.running = true;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    const loop = () => {
      if (!this.running) return;
      this.animationFrame = requestAnimationFrame(loop);
      this.animator.update(this.clock.getDelta() * 1000);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  syncToStateArray(state) {
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
    const views = {
      iso:   { pos: [3.6, 3.0, 4.8], target: [0, 0, 0] },
      front: { pos: [0, 0, 6.2],     target: [0, 0, 0] },
      top:   { pos: [0, 6.2, 0.001], target: [0, 0, 0] },
      right: { pos: [6.2, 0, 0],     target: [0, 0, 0] },
    };
    const target = views[view] || views.iso;
    this.camera.position.set(...target.pos);
    this.controls.target.set(...target.target);
    this.controls.update();
  }

  resetCamera() {
    this.setCameraView('iso');
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
