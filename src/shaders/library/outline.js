import { EventBus } from '../../utils/EventBus.js';

export const id = 'outline';
export const name = 'Outline';
export const category = 'post-process';
export const uiPosition = 23;
export const costTier = 'heavy';

export const params = [
  { key: 'edgeStrength', label: 'Edge Strength', min: 0.5, max: 5, step: 0.1, default: 1.0 },
  { key: 'edgeGlow', label: 'Edge Glow', min: 0, max: 5, step: 0.1, default: 2.0 },
  { key: 'edgeThickness', label: 'Thickness', min: 0.5, max: 5, step: 0.1, default: 1.0 },
];

export function apply(model) {
  if (!model) return;

  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  EventBus.emit('postprocess:enable', 'outline', {
    edgeStrength: 1.0,
    edgeGlow: 2.0,
    edgeThickness: 1.0
  });
}
