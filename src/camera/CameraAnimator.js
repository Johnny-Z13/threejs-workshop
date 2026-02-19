import * as THREE from 'three';
import { EventBus } from '../utils/EventBus.js';

/**
 * Camera animation system with multiple modes.
 * All mode transitions use smooth position + target lerp from current camera state.
 */
export class CameraAnimator {
  constructor(camera, controls) {
    this.camera = camera;
    this.controls = controls;
    this.mode = 'none';
    this.time = 0;
    this.speed = 1.0;
    this.modelBounds = null;

    // Transition state
    this.isTransitioning = false;
    this.transitionProgress = 0;
    this.transitionDuration = 1.2;
    this.transitionStartPos = new THREE.Vector3();
    this.transitionStartTarget = new THREE.Vector3();

    // Reusable vectors
    this._modePos = new THREE.Vector3();
    this._modeTarget = new THREE.Vector3();

    EventBus.on('camera:mode', (mode) => this.setMode(mode));
    EventBus.on('camera:setSpeed', (speed) => { this.speed = speed; });
    EventBus.on('camera:setFOV', (fov) => this.setFOV(fov));
    EventBus.on('camera:reset', () => this.reset());
    EventBus.on('camera:fit', () => this.fit());
    EventBus.on('model:loaded', (data) => {
      this.modelBounds = data.bounds;
      this.fit();
    });
  }

  setMode(mode) {
    if (mode === 'none' || this.mode === mode) {
      // Exit to manual — smooth transition to current position (just stop animation)
      this.mode = 'none';
      this.isTransitioning = false;
      this.controls.setEnabled(true);
      EventBus.emit('camera:mode:changed', this.mode);
      return;
    }

    // Entering a new mode (from manual or from another mode)
    const prevMode = this.mode;
    this.mode = mode;
    this.controls.setEnabled(false);

    if (this.modelBounds) {
      // Seed time from current camera angle so rotation starts from where we are
      this.initTimeFromCamera();
      this.beginTransition();
    } else {
      this.time = 0;
    }

    EventBus.emit('camera:mode:changed', this.mode);
  }

  /**
   * Derive this.time so the mode's orbit angle matches the camera's current
   * horizontal angle relative to model center. This prevents angular snapping.
   */
  initTimeFromCamera() {
    if (!this.modelBounds) { this.time = 0; return; }
    const { center } = this.modelBounds;
    const dx = this.camera.position.x - center.x;
    const dz = this.camera.position.z - center.z;
    const angle = Math.atan2(dz, dx);

    switch (this.mode) {
      case 'turntable': this.time = angle / 0.4; break;
      case 'cinematic': this.time = 0; this._cinShots = null; break;
      case 'bounce':    this.time = angle / 0.6; break;
      case 'drift':     this.time = angle / 0.12; break;
      default:          this.time = 0;
    }
  }

  /**
   * Start a smooth transition from current camera state to where the mode
   * animation wants the camera. Both position and look target are lerped.
   */
  beginTransition() {
    this.transitionStartPos.copy(this.camera.position);
    this.transitionStartTarget.copy(this.controls.controls.target);
    this.isTransitioning = true;
    this.transitionProgress = 0;
    // Cinematic gets a longer, more dramatic entry
    this.transitionDuration = this.mode === 'cinematic' ? 2.0 : 1.2;
  }

  fit() {
    if (!this.modelBounds) return;
    const { center, radius, box } = this.modelBounds;

    if (this.mode !== 'none') {
      this.mode = 'none';
      this.isTransitioning = false;
      EventBus.emit('camera:mode:changed', this.mode);
    }

    this.controls.setEnabled(true);

    const lookY = box ? (box.min.y + box.max.y) * 0.5 : center.y;
    const fitDist = this.getFitDistance(radius) * 1.1;

    const angleH = Math.PI / 6;
    const angleV = Math.PI / 10;

    this.camera.position.set(
      center.x + fitDist * Math.sin(angleH) * Math.cos(angleV),
      lookY + fitDist * Math.sin(angleV),
      center.z + fitDist * Math.cos(angleH) * Math.cos(angleV)
    );

    this.controls.setTarget(center.x, lookY, center.z);
    this.controls.update();
  }

  getFitDistance(radius) {
    const fovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = this.camera.aspect || (window.innerWidth / window.innerHeight);
    const vFov = fovRad / 2;
    const hFov = Math.atan(Math.tan(vFov) * aspect);
    return Math.max(radius / Math.sin(vFov), radius / Math.sin(hFov));
  }

  setFOV(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  reset() {
    if (this.mode !== 'none') this.setMode('none');
    this.speed = 1.0;
    this.camera.fov = 45;
    this.camera.updateProjectionMatrix();
    this.fit();
  }

  // ── Per-frame update ──

  update(deltaTime) {
    if (this.mode === 'none' || !this.modelBounds) return;
    const { center, radius } = this.modelBounds;

    // Advance animation time (always, even during transition, so the
    // target position evolves smoothly and we don't pop at the end)
    this.time += deltaTime * this.speed;

    // Compute where the mode wants the camera right now
    this.computeModeState(center, radius);

    if (this.isTransitioning) {
      this.transitionProgress += deltaTime / this.transitionDuration;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.isTransitioning = false;
      }

      // Smooth ease-out
      const t = this.transitionProgress;
      const eased = 1 - Math.pow(1 - t, 3);

      // Lerp both position and look target
      this.camera.position.lerpVectors(this.transitionStartPos, this._modePos, eased);
      const lerpTarget = this.transitionStartTarget.clone().lerp(this._modeTarget, eased);
      this.controls.setTarget(lerpTarget.x, lerpTarget.y, lerpTarget.z);
    } else {
      // Fully in mode — apply directly
      this.camera.position.copy(this._modePos);
      this.controls.setTarget(this._modeTarget.x, this._modeTarget.y, this._modeTarget.z);
    }

    this.camera.lookAt(this.controls.controls.target);
  }

  /**
   * Compute position + look target for the current mode at this.time.
   * Writes into this._modePos and this._modeTarget.
   */
  computeModeState(center, radius) {
    switch (this.mode) {
      case 'turntable': this.stateTurntable(center, radius); break;
      case 'cinematic': this.stateCinematic(center, radius); break;
      case 'drift':     this.stateDrift(center, radius); break;
      case 'bounce':    this.stateBounce(center, radius); break;
    }
  }

  stateTurntable(center, radius) {
    const angle = this.time * 0.4;
    const r = radius * 1.6;
    this._modePos.set(
      center.x + Math.cos(angle) * r,
      center.y + radius * 0.4,
      center.z + Math.sin(angle) * r
    );
    this._modeTarget.copy(center);
  }

  /**
   * Cinematic mode — a looping sequence of dramatic camera shots.
   * Each shot defines start/end positions + look targets + duration.
   * The camera smoothly interpolates within each shot, then crossfades
   * into the next. Designed to show off any model like a reel.
   */
  stateCinematic(center, radius) {
    if (!this._cinShots) this._buildCinematicShots();

    const shots = this._cinShots;
    const totalDuration = shots.reduce((sum, s) => sum + s.dur, 0);
    const loopTime = ((this.time) % totalDuration + totalDuration) % totalDuration;

    // Find current shot
    let elapsed = 0;
    let shotIdx = 0;
    for (let i = 0; i < shots.length; i++) {
      if (loopTime < elapsed + shots[i].dur) {
        shotIdx = i;
        break;
      }
      elapsed += shots[i].dur;
    }

    const shot = shots[shotIdx];
    const shotT = (loopTime - elapsed) / shot.dur;
    const eased = this._cinematicEase(shotT);

    // Interpolate position
    const r = radius;
    const cx = center.x, cy = center.y, cz = center.z;

    const px = cx + r * THREE.MathUtils.lerp(shot.from[0], shot.to[0], eased);
    const py = cy + r * THREE.MathUtils.lerp(shot.from[1], shot.to[1], eased);
    const pz = cz + r * THREE.MathUtils.lerp(shot.from[2], shot.to[2], eased);
    this._modePos.set(px, py, pz);

    // Interpolate look target
    const tx = cx + r * THREE.MathUtils.lerp(shot.lookFrom[0], shot.lookTo[0], eased);
    const ty = cy + r * THREE.MathUtils.lerp(shot.lookFrom[1], shot.lookTo[1], eased);
    const tz = cz + r * THREE.MathUtils.lerp(shot.lookFrom[2], shot.lookTo[2], eased);
    this._modeTarget.set(tx, ty, tz);
  }

  _cinematicEase(t) {
    // Smooth ease-in-out (feels like a real dolly move)
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  _buildCinematicShots() {
    // All positions are multipliers of radius, relative to center.
    // [x, y, z] where y=0 is model center height.
    // Each shot: { from, to, lookFrom, lookTo, dur }
    this._cinShots = [
      // 1. Hero establishing shot — wide 3/4, slow arc
      {
        from: [2.0, 0.4, 1.2],  to: [0.8, 0.5, 2.2],
        lookFrom: [0, 0.1, 0],  lookTo: [0, 0.15, 0],
        dur: 5.0
      },
      // 2. Low angle power shot — looking up at the model
      {
        from: [0.8, -0.3, 2.0], to: [-1.0, -0.2, 1.8],
        lookFrom: [0, 0.3, 0],  lookTo: [0, 0.4, 0],
        dur: 4.0
      },
      // 3. Close-up detail pass — tight orbit at head height
      {
        from: [-0.6, 0.6, 0.9], to: [0.5, 0.55, 0.8],
        lookFrom: [0, 0.5, 0],  lookTo: [0, 0.45, 0],
        dur: 4.5
      },
      // 4. Dramatic pull-back reveal — starts close, pulls way out
      {
        from: [0.4, 0.3, 0.7],  to: [2.5, 0.8, 2.0],
        lookFrom: [0, 0.2, 0],  lookTo: [0, 0.1, 0],
        dur: 5.5
      },
      // 5. High angle — bird's eye sweeping down
      {
        from: [1.5, 2.0, 1.5],  to: [-1.2, 1.5, 1.8],
        lookFrom: [0, 0, 0],    lookTo: [0, 0.1, 0],
        dur: 4.5
      },
      // 6. Slow side dolly — profile tracking shot
      {
        from: [-2.2, 0.3, 0.0], to: [-2.0, 0.4, -1.5],
        lookFrom: [0, 0.2, 0],  lookTo: [0, 0.25, 0],
        dur: 4.0
      },
      // 7. Behind the shoulder — swings around the back
      {
        from: [-1.5, 0.5, -1.8], to: [1.0, 0.3, -1.5],
        lookFrom: [0, 0.3, 0],   lookTo: [0, 0.2, 0.1],
        dur: 4.5
      },
      // 8. Rising crane shot — ground level to overhead
      {
        from: [1.5, -0.1, 1.5], to: [1.8, 1.8, 0.5],
        lookFrom: [0, 0.1, 0],  lookTo: [0, 0.2, 0],
        dur: 5.0
      },
    ];
  }

  stateDrift(center, radius) {
    const a1 = this.time * 0.12;
    const a2 = this.time * 0.08;
    const r = radius * 1.6 * (1.0 + Math.sin(this.time * 0.06) * 0.15);
    this._modePos.set(
      center.x + Math.sin(a1) * r,
      center.y + radius * (0.35 + Math.sin(a2) * 0.15),
      center.z + Math.sin(a1 * 2) * r * 0.6
    );
    this._modeTarget.copy(center);
  }

  stateBounce(center, radius) {
    const angle = this.time * 0.6;
    const beat = Math.abs(Math.sin(this.time * 2.0));
    const snap = Math.pow(beat, 4.0);
    const r = radius * 1.6 * (0.9 - snap * 0.35);
    const y = center.y + radius * (0.3 + snap * 0.25);
    this._modePos.set(
      center.x + Math.cos(angle) * r, y,
      center.z + Math.sin(angle) * r
    );
    this._modeTarget.copy(center);
  }
}
