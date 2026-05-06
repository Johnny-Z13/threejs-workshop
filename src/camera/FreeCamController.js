import * as THREE from 'three';
import { EventBus } from '../utils/EventBus.js';

/**
 * Unreal-style free camera. WASD to move, QE for down/up.
 * Mouse look uses pointer lock when available; otherwise falls back to
 * click-and-drag so it still works in iframes / locked-down browsers.
 *
 * While active, OrbitControls is fully disposed so it cannot interfere
 * with camera input or position. A fresh OrbitControls is rebuilt when
 * Free Cam exits.
 */
export class FreeCamController {
  constructor(camera, controlsWrapper, domElement) {
    this.camera = camera;
    this.controlsWrapper = controlsWrapper;
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

    this._dragLooking = false;
    this._lastMouseX = 0;
    this._lastMouseY = 0;
    this._usePointerLock = !!document.body.requestPointerLock;

    this._velocity = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onContextMenu = (e) => e.preventDefault();

    EventBus.on('freecam:setEnabled', (on) => this.setEnabled(on));
    EventBus.on('freecam:setSpeed', (mul) => { this.userSpeedMul = mul; });
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;

    if (on) {
      console.log('[FreeCam] enabled — disposing OrbitControls');
      // Stop any camera animation mode and tear down OrbitControls completely.
      EventBus.emit('camera:mode', 'none');
      this.controlsWrapper.dispose();

      this._syncYawPitchFromCamera();

      window.addEventListener('keydown', this._onKeyDown);
      window.addEventListener('keyup', this._onKeyUp);
      this.domElement.addEventListener('mousedown', this._onMouseDown);
      window.addEventListener('mouseup', this._onMouseUp);
      this.domElement.addEventListener('contextmenu', this._onContextMenu);
      document.addEventListener('pointerlockchange', this._onPointerLockChange);

      this.domElement.style.cursor = 'crosshair';
    } else {
      console.log('[FreeCam] disabled — rebuilding OrbitControls');
      window.removeEventListener('keydown', this._onKeyDown);
      window.removeEventListener('keyup', this._onKeyUp);
      this.domElement.removeEventListener('mousedown', this._onMouseDown);
      window.removeEventListener('mouseup', this._onMouseUp);
      this.domElement.removeEventListener('contextmenu', this._onContextMenu);
      document.removeEventListener('pointerlockchange', this._onPointerLockChange);
      window.removeEventListener('mousemove', this._onMouseMove);

      if (document.pointerLockElement === this.domElement) {
        document.exitPointerLock();
      }
      this.keys.clear();
      this._dragLooking = false;
      this.domElement.style.cursor = '';

      // Rebuild OrbitControls anchored 2 units in front of where the camera ended up.
      const tgt = new THREE.Vector3();
      this.camera.getWorldDirection(tgt);
      tgt.multiplyScalar(2).add(this.camera.position);
      this.controlsWrapper.rebuild(tgt);
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
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    if (this._usePointerLock && document.pointerLockElement !== this.domElement) {
      // Try pointer lock; if it fails or is denied, the pointerlockerror
      // event won't fire here — fall back gracefully via drag-look below.
      try { this.domElement.requestPointerLock(); } catch (_) { /* ignore */ }
    }
    // Always start drag-look as a fallback in case pointer lock is denied.
    this._dragLooking = true;
    this._lastMouseX = e.clientX;
    this._lastMouseY = e.clientY;
    window.addEventListener('mousemove', this._onMouseMove);
  }

  _onMouseUp() {
    if (this._dragLooking && document.pointerLockElement !== this.domElement) {
      this._dragLooking = false;
      window.removeEventListener('mousemove', this._onMouseMove);
    }
  }

  _onPointerLockChange() {
    if (document.pointerLockElement === this.domElement) {
      this._dragLooking = false; // pointer lock takes over
      window.addEventListener('mousemove', this._onMouseMove);
    } else {
      window.removeEventListener('mousemove', this._onMouseMove);
    }
  }

  _onMouseMove(e) {
    let dx, dy;
    if (document.pointerLockElement === this.domElement) {
      dx = e.movementX;
      dy = e.movementY;
    } else if (this._dragLooking) {
      dx = e.clientX - this._lastMouseX;
      dy = e.clientY - this._lastMouseY;
      this._lastMouseX = e.clientX;
      this._lastMouseY = e.clientY;
    } else {
      return;
    }

    this._yaw -= dx * this.lookSensitivity;
    this._pitch -= dy * this.lookSensitivity;
    const limit = Math.PI / 2 - 0.001;
    if (this._pitch > limit) this._pitch = limit;
    if (this._pitch < -limit) this._pitch = -limit;
  }

  setSceneScale(radius) {
    this._sceneRadius = radius && isFinite(radius) ? radius : 1;
  }

  update(deltaTime) {
    if (!this.enabled) return;

    let mul = this.userSpeedMul;
    if (this.keys.has('shift')) mul *= this.sprintMul;
    if (this.keys.has('control')) mul *= this.slowMul;

    const scale = this._sceneRadius || 1;
    const speed = this.baseSpeed * mul * scale;

    // Build movement in camera-relative space using yaw only (Q/E stay world-up).
    const yawSin = Math.sin(this._yaw);
    const yawCos = Math.cos(this._yaw);
    // camera-forward (in XZ plane): (-sin(yaw), 0, -cos(yaw))
    this._forward.set(-yawSin, 0, -yawCos);
    // camera-right: forward × up
    this._right.set(yawCos, 0, -yawSin);

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

    // Apply look orientation last so nothing else can override it this frame.
    this._euler.set(this._pitch, this._yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
    this.camera.updateMatrixWorld();
  }
}
