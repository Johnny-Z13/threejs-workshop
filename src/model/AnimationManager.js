import * as THREE from 'three';
import { EventBus } from '../utils/EventBus.js';

/**
 * Animation mixer, actions, switching, and clip management
 */
export class AnimationManager {
  constructor() {
    this.mixer = null;
    this.actions = {};
    this.activeAction = null;
    this.allAnimations = [];
  }

  get clock() {
    if (!this._clock) this._clock = new THREE.Clock();
    return this._clock;
  }

  setupAnimations(modelRef, animations) {
    this.clearActions();
    this.allAnimations = [...animations];

    if (this.allAnimations.length === 0 || !modelRef) return;

    this.mixer = new THREE.AnimationMixer(modelRef);
    this.allAnimations.forEach((clip) => {
      this.actions[clip.name] = this.mixer.clipAction(clip);
    });

    const names = Object.keys(this.actions);
    if (names.length > 0) this.switchAnimation(names[0]);

    EventBus.emit('animations:updated', this.allAnimations, this.actions);
  }

  switchAnimation(name) {
    if (!this.actions[name] || this.actions[name] === this.activeAction) return;
    const prevAction = this.activeAction;
    this.activeAction = this.actions[name];
    if (prevAction) prevAction.fadeOut(0.3);
    this.activeAction.reset().fadeIn(0.3).play();
    EventBus.emit('animation:switched', name);
  }

  mergeAnimations(newClips) {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
    }
    this.allAnimations.push(...newClips);
  }

  deleteAnimation(name) {
    if (this.actions[name] === this.activeAction) {
      this.activeAction.stop();
      this.activeAction = null;
    }
    this.actions[name].stop();
    this.mixer.uncacheAction(this.actions[name].getClip());
    this.mixer.uncacheClip(this.actions[name].getClip());
    delete this.actions[name];

    const idx = this.allAnimations.findIndex(c => c.name === name);
    if (idx !== -1) this.allAnimations.splice(idx, 1);

    if (!this.activeAction) {
      const remaining = Object.keys(this.actions);
      if (remaining.length > 0) this.switchAnimation(remaining[0]);
    }

    EventBus.emit('animations:updated', this.allAnimations, this.actions);
  }

  clearActions() {
    for (const key of Object.keys(this.actions)) delete this.actions[key];
    this.activeAction = null;
  }

  update() {
    const delta = this.clock.getDelta();
    if (this.mixer) this.mixer.update(delta);
    return delta;
  }

  dispose() {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer.uncacheRoot(this.mixer.getRoot());
      this.mixer = null;
    }
    this.clearActions();
    this.allAnimations = [];
  }
}
