import { EventBus } from '../../utils/EventBus.js';

export const id = 'vaporwave';
export const name = 'Vaporwave';
export const category = 'post-process';
export const uiPosition = 16;
export const costTier = 'light';

export const params = [
  { key: 'intensity', label: 'Intensity', min: 0.2, max: 2, step: 0.1, default: 1.0 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable vaporwave post-processing
  EventBus.emit('postprocess:enable', 'vaporwave', {});
}
