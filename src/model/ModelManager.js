import * as THREE from 'three';
import { EventBus } from '../utils/EventBus.js';
import { CONFIG } from '../config.js';
import { sanitizeGeometry, normalizeModel } from './DetoxPipeline.js';

/**
 * Model lifecycle — load, setup, clear, track state
 */
export class ModelManager {
  constructor(scene) {
    this.scene = scene;
    this.modelRef = null;
    this.loadedFileName = '';
  }

  clearModel() {
    if (this.modelRef) {
      this.scene.remove(this.modelRef);
      this.modelRef.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => {
            m.map?.dispose();
            m.normalMap?.dispose();
            m.roughnessMap?.dispose();
            m.metalnessMap?.dispose();
            m.emissiveMap?.dispose();
            m.dispose();
          });
        }
      });
      this.modelRef = null;
    }
    this.loadedFileName = '';
  }

  setupModel(model, name) {
    this.modelRef = model;
    this.loadedFileName = name;

    model.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Save original material for shader mode switching
        child.userData.originalMaterial = child.material;
      }
    });

    // Sanitize geometry before normalization
    sanitizeGeometry(model);
    model.updateMatrixWorld(true);
    normalizeModel(model, CONFIG.MODEL_SIZE);
    this.scene.add(model);

    // Compute and emit bounds for camera system
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius;
    EventBus.emit('model:loaded', { bounds: { box, center, size, radius } });
  }

  getInfo() {
    if (!this.modelRef) return null;
    let meshCount = 0, vertCount = 0;
    this.modelRef.traverse((child) => {
      if (child.isMesh) {
        meshCount++;
        vertCount += child.geometry.attributes.position.count;
      }
    });
    return {
      name: this.loadedFileName,
      meshCount,
      vertCount,
      animCount: 0, // set by caller
    };
  }
}
