import { EventBus } from '../../utils/EventBus.js';

export const id = 'filmgrain';
export const name = 'Film Grain';
export const category = 'post-process';
export const uiPosition = 21;
export const costTier = 'trivial';

export const params = [
  { key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01, default: 0.35 },
  { key: 'speed', label: 'Speed', min: 0, max: 5, step: 0.1, default: 1.0 },
];

export function apply(model) {
  if (!model) return;

  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  EventBus.emit('postprocess:enable', 'filmgrain', {
    intensity: 0.35,
    speed: 1.0
  });
}
