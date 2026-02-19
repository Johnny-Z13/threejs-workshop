import { EventBus } from '../../utils/EventBus.js';

/**
 * Cel Shading / Toon shader - popular in games like Zelda, Borderlands
 */
export const id = 'celshading';
export const name = 'Cel Shading';
export const key = '8';
export const category = 'post-process';
export const uiPosition = 8;
export const costTier = 'medium';

export const params = [
  { key: 'colorLevels', label: 'Color Levels', min: 2, max: 10, step: 1, default: 4 },
  { key: 'edgeThreshold', label: 'Edge Thickness', min: 0.02, max: 0.5, step: 0.01, default: 0.15 },
  { key: 'edgeDarkness', label: 'Edge Darkness', min: 0, max: 1, step: 0.05, default: 0 },
];

export function apply(model) {
  if (!model) return;

  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable cel shading post-process pass
  EventBus.emit('postprocess:enable', 'celshading', {
    clearColor: 0x1a1a1e
  });
}
