import * as THREE from 'three';
import { EventBus } from '../utils/EventBus.js';

/**
 * Standalone WASD + mouse-drag free camera.
 * - Hold left mouse button anywhere on the canvas and drag to look.
 * - WASD moves along yaw (Y stays world-up).
 * - Q/E lower/raise.
 * - Shift = sprint, Ctrl = slow.
 *
 * Owns the camera transform completely while enabled. The render loop
 * skips all other camera systems when this is active.
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
    this.lookSensitivity = 0.0035;

    this.keys = new Set();
    this._yaw = 0;
    this._pitch = 0;

    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;

    this._velocity = new THREE.Vector3();
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
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
      console.log('[FreeCam] ON — disposing OrbitControls');
      EventBus.emit('camera:mode', 'none');
      this.controlsWrapper.dispose();

      this._syncYawPitchFromCamera();

      // Attach to window for everything so no overlay or stacking context
      // can intercept the events.
      window.addEventListener('keydown', this._onKeyDown, true);
      window.addEventListener('keyup', this._onKeyUp, true);
      window.addEventListener('mousedown', this._onMouseDown, true);
      window.addEventListener('mouseup', this._onMouseUp, true);
      window.addEventListener('mousemove', this._onMouseMove, true);
      window.addEventListener('contextmenu', this._onContextMenu, true);

      this.domElement.style.cursor = 'crosshair';
    } else {
      console.log('[FreeCam] OFF — rebuilding OrbitControls');
      window.removeEventListener('keydown', this._onKeyDown, true);
      window.removeEventListener('keyup', this._onKeyUp, true);
      window.removeEventListener('mousedown', this._onMouseDown, true);
      window.removeEventListener('mouseup', this._onMouseUp, true);
      window.removeEventListener('mousemove', this._onMouseMove, true);
      window.removeEventListener('contextmenu', this._onContextMenu, true);

      this.keys.clear();
      this._dragging = false;
      this.domElement.style.cursor = '';

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
  }

  _onKeyUp(e) {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
  }

  _onMouseDown(e) {
    // Only start a look-drag if the click is on the canvas (or its viewport
    // container). UI clicks (panels, buttons) should pass through normally.
    const t = e.target;
    const isCanvas = t === this.domElement ||
                     t === document.getElementById('viewport') ||
                     (t && t.closest && t.closest('#viewport'));
    if (!isCanvas) return;
    this._dragging = true;
    this._lastX = e.clientX;
    this._lastY = e.clientY;
    this.domElement.style.cursor = 'grabbing';
    console.log('[FreeCam] drag start');
  }

  _onMouseUp() {
    if (!this._dragging) return;
    this._dragging = false;
    this.domElement.style.cursor = 'crosshair';
  }

  _onMouseMove(e) {
    if (!this._dragging) return;
    const dx = e.clientX - this._lastX;
    const dy = e.clientY - this._lastY;
    this._lastX = e.clientX;
    this._lastY = e.clientY;

    this._yaw -= dx * this.lookSensitivity;
    this._pitch -= dy * this.lookSensitivity;
    const limit = Math.PI / 2 - 0.001;
    if (this._pitch > limit) this._pitch = limit;
    if (this._pitch < -limit) this._pitch = -limit;
    if (!this._lastLogTime || performance.now() - this._lastLogTime > 500) {
      this._lastLogTime = performance.now();
      console.log(`[FreeCam] yaw=${this._yaw.toFixed(2)} pitch=${this._pitch.toFixed(2)}`);
    }
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

    // Yaw-only horizontal axes so W goes "forward on the ground" not into sky.
    const yawSin = Math.sin(this._yaw);
    const yawCos = Math.cos(this._yaw);
    this._forward.set(-yawSin, 0, -yawCos);
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

    // Apply look orientation directly to the camera quaternion.
    this._euler.set(this._pitch, this._yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
    this.camera.updateMatrixWorld();
  }
}
