import { EventBus } from '../../utils/EventBus.js';

export const id = 'xray';
export const name = 'X-Ray';
export const category = 'post-process';
export const uiPosition = 18;
export const costTier = 'medium';

export const params = [
  { key: 'glowIntensity', label: 'Glow', min: 0.5, max: 5, step: 0.1, default: 2.0 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable X-ray post-processing
  EventBus.emit('postprocess:enable', 'xray', {
    glowIntensity: 2.0
  });
}
