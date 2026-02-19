import { EventBus } from '../../utils/EventBus.js';

export const id = 'dithered';
export const name = '1-bit Dithered';
export const key = '5';
export const category = 'post-process';
export const uiPosition = 10;
export const costTier = 'medium';

export const params = [
  { key: 'threshold', label: 'Threshold', min: 0.1, max: 0.9, step: 0.05, default: 0.5 },
  { key: 'ditherScale', label: 'Scale', min: 0.3, max: 3, step: 0.1, default: 1.0 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable dithered post-processing
  EventBus.emit('postprocess:enable', 'dithered', {
    ditherScale: 1.0
  });
}
