import { EventBus } from '../../utils/EventBus.js';

/**
 * Cinematic quality mode - highest quality PBR with enhanced settings
 */
export const id = 'cinematic';
export const name = 'Cinematic';
export const key = '1';
export const category = 'material';
export const uiPosition = 1;

export const params = [
  { key: 'envMapIntensity', label: 'Env Intensity', min: 0.2, max: 3, step: 0.1, default: 1.0 },
];

export function apply(model) {
  if (!model) return;

  // Reset to original PBR materials (highest quality)
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;

      // Enhance material properties for cinema quality
      if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
        // Enable environment mapping if available
        if (!child.material.envMapIntensity) {
          child.material.envMapIntensity = 1.0;
        }

        // Ensure proper metalness/roughness response
        child.material.needsUpdate = true;
      }
    }
  });

  // Emit event to enhance renderer settings
  EventBus.emit('renderer:setCinematicQuality');
}
