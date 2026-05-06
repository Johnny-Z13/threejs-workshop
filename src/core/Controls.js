import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * OrbitControls wrapper. FreeCam takes over by setting enabled=false, which
 * makes OrbitControls' pointerdown handler early-return — no setPointerCapture,
 * no errors. Listeners stay attached, so we never re-instantiate.
 */
export class Controls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    const c = new OrbitControls(camera, domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.05;
    c.target.set(0, 1, 0);
    c.minDistance = 0.5;
    c.maxDistance = 10;
    c.maxPolarAngle = Math.PI * 0.85;
    this.controls = c;
  }

  update() {
    this.controls.update();
  }

  setEnabled(enabled) {
    this.controls.enabled = enabled;
  }

  setTarget(x, y, z) {
    this.controls.target.set(x, y, z);
  }
}
