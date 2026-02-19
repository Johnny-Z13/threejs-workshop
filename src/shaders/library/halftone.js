import { EventBus } from '../../utils/EventBus.js';

export const id = 'halftone';
export const name = 'Halftone';
export const category = 'post-process';
export const uiPosition = 22;
export const costTier = 'medium';

export const params = [
  { key: 'dotSize', label: 'Dot Size', min: 2, max: 20, step: 1, default: 6 },
  { key: 'shape', label: 'Shape', min: 1, max: 4, step: 1, default: 1 },
];

export function apply(model) {
  if (!model) return;

  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  EventBus.emit('postprocess:enable', 'halftone', {
    dotSize: 6,
    shape: 1
  });
}
