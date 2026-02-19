import { EventBus } from '../../utils/EventBus.js';

export const id = 'thermal';
export const name = 'Thermal Vision';
export const category = 'post-process';
export const uiPosition = 17;
export const costTier = 'medium';

export const params = [
  { key: 'noiseAmount', label: 'Noise', min: 0, max: 0.3, step: 0.01, default: 0.1 },
  { key: 'scanlineIntensity', label: 'Scanlines', min: 0, max: 0.15, step: 0.005, default: 0.05 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable thermal post-processing
  EventBus.emit('postprocess:enable', 'thermal', {});
}
