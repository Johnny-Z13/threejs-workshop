import { EventBus } from '../../utils/EventBus.js';

/**
 * Glitch Effect - cyberpunk digital corruption
 */
export const id = 'glitch';
export const name = 'Glitch';
export const key = '9';
export const category = 'post-process';
export const uiPosition = 9;
export const costTier = 'light';

export const params = [
  { key: 'glitchIntensity', label: 'Intensity', min: 0, max: 2, step: 0.05, default: 0.5 },
];

export function apply(model) {
  if (!model) return;

  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable glitch post-process pass
  EventBus.emit('postprocess:enable', 'glitch', {
    clearColor: 0x0a0a0f
  });
}
