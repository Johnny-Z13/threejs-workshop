import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * OrbitControls wrapper
 */
export class Controls {
  constructor(camera, domElement) {
    this.controls = new OrbitControls(camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, 1, 0);
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 10;
    this.controls.maxPolarAngle = Math.PI * 0.85;
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

  dispose() {
    this.controls.dispose();
  }
}
