import { EventBus } from '../../utils/EventBus.js';

export const id = 'vhs';
export const name = 'VHS Tape';
export const category = 'post-process';
export const uiPosition = 14;
export const costTier = 'light';

export const params = [
  { key: 'noiseIntensity', label: 'Noise', min: 0, max: 0.5, step: 0.01, default: 0.15 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable VHS post-processing
  EventBus.emit('postprocess:enable', 'vhs', {
    noiseIntensity: 0.15
  });
}
