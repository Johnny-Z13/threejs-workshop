import * as THREE from 'three';
import { EventBus } from '../utils/EventBus.js';

/**
 * Unreal-style free camera. WASD to move, QE for down/up,
 * mouse to look (pointer-locked while held by viewport).
 * Shift = sprint, Ctrl = slow.
 */
export class FreeCamController {
  constructor(camera, controls, domElement) {
    this.camera = camera;
    this.controls = controls;
    this.domElement = domElement;
    this.enabled = false;

    this.baseSpeed = 3.0;
    this.userSpeedMul = 1.0;
    this.sprintMul = 3.0;
    this.slowMul = 0.3;
    this.lookSensitivity = 0.0025;

    this.keys = new Set();
    this._yaw = 0;
    this._pitch = 0;
    this._velocity = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);

    EventBus.on('freecam:setEnabled', (on) => this.setEnabled(on));
    EventBus.on('freecam:setSpeed', (mul) => { this.userSpeedMul = mul; });

    // If the user activates a camera animation mode, free cam should release.
    EventBus.on('camera:mode:changed', (mode) => {
      if (this.enabled && mode && mode !== 'none') this.setEnabled(false);
    });
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) {
      this._syncYawPitchFromCamera();
      // Clear any active camera animation mode first.
      EventBus.emit('camera:mode', 'none');
      // Lock OrbitControls so async events (model:loaded → fit, setMode, etc.)
      // can't silently re-enable orbit input behind us.
      this.controls.setLocked(true);
      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this.domElement.addEventListener('mousedown', this._onMouseDown);
      document.addEventListener('pointerlockchange', this._onPointerLockChange);
      this.domElement.style.cursor = 'crosshair';
    } else {
      this.controls.setLocked(false);
      this.controls.setEnabled(true);
      // Anchor OrbitControls' target just in front of where the camera
      // ended up, so it doesn't yank back to the old target.
      const tgt = new THREE.Vector3();
      this.camera.getWorldDirection(tgt);
      tgt.multiplyScalar(2).add(this.camera.position);
      this.controls.setTarget(tgt.x, tgt.y, tgt.z);

      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      this.domElement.removeEventListener('mousedown', this._onMouseDown);
      document.removeEventListener('pointerlockchange', this._onPointerLockChange);
      document.removeEventListener('mousemove', this._onMouseMove);
      if (document.pointerLockElement === this.domElement) {
        document.exitPointerLock();
      }
      this.keys.clear();
      this.domElement.style.cursor = '';
    }
    EventBus.emit('freecam:changed', this.enabled);
  }

  _syncYawPitchFromCamera() {
    this._euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this._yaw = this._euler.y;
    this._pitch = this._euler.x;
  }

  _onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) return;
    const k = e.key.toLowerCase();
    if (['w','a','s','d','q','e','shift','control'].includes(k) ||
        ['arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
      this.keys.add(k);
      e.preventDefault();
    }
    if (k === 'escape' && document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    if (document.pointerLockElement !== this.domElement) {
      this.domElement.requestPointerLock?.();
    }
  }

  _onPointerLockChange() {
    if (document.pointerLockElement === this.domElement) {
      document.addEventListener('mousemove', this._onMouseMove);
    } else {
      document.removeEventListener('mousemove', this._onMouseMove);
    }
  }

  _onMouseMove(e) {
    this._yaw -= e.movementX * this.lookSensitivity;
    this._pitch -= e.movementY * this.lookSensitivity;
    const limit = Math.PI / 2 - 0.001;
    if (this._pitch > limit) this._pitch = limit;
    if (this._pitch < -limit) this._pitch = -limit;
    this._applyLook();
  }

  _applyLook() {
    this._euler.set(this._pitch, this._yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
  }

  /**
   * Speed scales with model size so big rooms still feel responsive.
   * Called by main with the current model bounds (or null).
   */
  setSceneScale(radius) {
    this._sceneRadius = radius && isFinite(radius) ? radius : 1;
  }

  update(deltaTime) {
    if (!this.enabled) return;

    // Re-apply quaternion in case OrbitControls touched things on disable frame
    this._applyLook();

    let mul = this.userSpeedMul;
    if (this.keys.has('shift')) mul *= this.sprintMul;
    if (this.keys.has('control')) mul *= this.slowMul;

    const scale = this._sceneRadius || 1;
    const speed = this.baseSpeed * mul * scale;

    // Camera-relative axes
    this.camera.getWorldDirection(this._forward);
    this._right.crossVectors(this._forward, this._up).normalize();

    this._velocity.set(0, 0, 0);
    if (this.keys.has('w') || this.keys.has('arrowup'))    this._velocity.add(this._forward);
    if (this.keys.has('s') || this.keys.has('arrowdown'))  this._velocity.sub(this._forward);
    if (this.keys.has('d') || this.keys.has('arrowright')) this._velocity.add(this._right);
    if (this.keys.has('a') || this.keys.has('arrowleft'))  this._velocity.sub(this._right);
    if (this.keys.has('e')) this._velocity.y += 1;
    if (this.keys.has('q')) this._velocity.y -= 1;

    if (this._velocity.lengthSq() > 0) {
      this._velocity.normalize().multiplyScalar(speed * deltaTime);
      this.camera.position.add(this._velocity);
    }
  }
}
