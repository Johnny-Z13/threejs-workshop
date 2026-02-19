import { EventBus } from '../../utils/EventBus.js';

export const id = 'dof';
export const name = 'Depth of Field';
export const category = 'post-process';
export const uiPosition = 20;
export const costTier = 'heavy';

export const params = [
  { key: 'focus', label: 'Focus', min: 0.1, max: 20, step: 0.1, default: 2.0 },
  { key: 'aperture', label: 'Aperture', min: 0, max: 0.1, step: 0.001, default: 0.025 },
  { key: 'maxblur', label: 'Max Blur', min: 0, max: 0.02, step: 0.001, default: 0.01 },
];

export function apply(model) {
  if (!model) return;

  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  EventBus.emit('postprocess:enable', 'dof', {
    focus: 2.0,
    aperture: 0.025,
    maxblur: 0.01
  });
}
