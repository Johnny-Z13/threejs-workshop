import { EventBus } from '../../utils/EventBus.js';

export const id = 'psychedelic';
export const name = 'Psychedelic';
export const category = 'post-process';
export const uiPosition = 13;
export const costTier = 'light';

export const params = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 2, step: 0.05, default: 1.0 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable psychedelic post-processing
  EventBus.emit('postprocess:enable', 'psychedelic', {
    intensity: 1.0
  });
}
