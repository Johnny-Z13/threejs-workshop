import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * OrbitControls wrapper with full dispose/rebuild support so other camera
 * systems (Free Cam) can completely take over input without OrbitControls
 * running its update() loop or grabbing pointer events.
 */
export class Controls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.controls = null;
    this._build(new THREE.Vector3(0, 1, 0));
  }

  _build(target) {
    const c = new OrbitControls(this.camera, this.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.05;
    c.target.copy(target);
    c.minDistance = 0.5;
    c.maxDistance = 10;
    c.maxPolarAngle = Math.PI * 0.85;
    this.controls = c;
  }

  update() {
    if (!this.controls) return;
    this.controls.update();
  }

  setEnabled(enabled) {
    if (!this.controls) return;
    this.controls.enabled = enabled;
  }

  setTarget(x, y, z) {
    if (!this.controls) return;
    this.controls.target.set(x, y, z);
  }

  /** Tear down OrbitControls completely (removes all DOM listeners). */
  dispose() {
    if (this.controls) {
      this.controls.dispose();
      this.controls = null;
    }
  }

  /** Recreate OrbitControls aimed at the given target vector. */
  rebuild(target) {
    if (this.controls) this.dispose();
    this._build(target);
    this.controls.update();
  }
}
