import { EventBus } from '../../utils/EventBus.js';

export const id = 'gameboy';
export const name = 'Game Boy';
export const category = 'post-process';
export const uiPosition = 15;
export const costTier = 'light';

export const params = [
  { key: 'pixelSize', label: 'Pixel Size', min: 1, max: 10, step: 0.5, default: 4.0 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable Game Boy post-processing
  EventBus.emit('postprocess:enable', 'gameboy', {
    pixelSize: 4.0
  });
}
