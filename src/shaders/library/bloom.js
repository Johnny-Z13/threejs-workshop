import { EventBus } from '../../utils/EventBus.js';

export const id = 'bloom';
export const name = 'Bloom';
export const category = 'post-process';
export const uiPosition = 19;
export const costTier = 'light';

export const params = [
  { key: 'strength', label: 'Strength', min: 0, max: 3, step: 0.05, default: 1.5 },
  { key: 'threshold', label: 'Threshold', min: 0, max: 1, step: 0.05, default: 0.5 },
  { key: 'radius', label: 'Radius', min: 0, max: 2, step: 0.05, default: 0.4 },
];

export function apply(model) {
  if (!model) return;

  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  EventBus.emit('postprocess:enable', 'bloom', {
    strength: 1.5,
    threshold: 0.5,
    radius: 0.4
  });
}
