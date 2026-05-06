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
    this.locked = false;
  }

  update() {
    if (this.locked) return;
    this.controls.update();
  }

  /**
   * When locked, OrbitControls is force-disabled and any setEnabled(true)
   * calls from other systems (CameraAnimator.fit, setMode, etc.) are ignored.
   * Used by FreeCamController so async events like model:loaded can't
   * silently re-enable orbit input.
   */
  setLocked(locked) {
    this.locked = locked;
    if (locked) this.controls.enabled = false;
  }

  setEnabled(enabled) {
    if (this.locked) return;
    this.controls.enabled = enabled;
  }

  setTarget(x, y, z) {
    this.controls.target.set(x, y, z);
  }

  dispose() {
    this.controls.dispose();
  }
}
