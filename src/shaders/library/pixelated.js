import { EventBus } from '../../utils/EventBus.js';

export const id = 'pixelated';
export const name = '8-bit Pixel';
export const key = '6';
export const category = 'post-process';
export const uiPosition = 11;
export const costTier = 'medium';

export const params = [
  { key: 'pixelSize', label: 'Pixel Size', min: 2, max: 20, step: 1, default: 6 },
  { key: 'colorDepth', label: 'Color Depth', min: 2, max: 32, step: 1, default: 8 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable pixelated post-processing
  EventBus.emit('postprocess:enable', 'pixelated', {
    pixelSize: 6.0,
    colorDepth: 8.0
  });
}
