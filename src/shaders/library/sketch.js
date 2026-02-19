import { EventBus } from '../../utils/EventBus.js';

/**
 * Sketch (edge detection + cross-hatch) post-processing mode
 */
export const id = 'sketch';
export const name = 'Sketch';
export const key = '0';
export const category = 'post-process';
export const uiPosition = 6;
export const costTier = 'medium';

export const params = [
  { key: 'edgeThreshold', label: 'Edge Strength', min: 0.02, max: 0.4, step: 0.01, default: 0.04 },
  { key: 'hatchDensity', label: 'Hatch Density', min: 20, max: 200, step: 5, default: 80 },
  { key: 'inkDarkness', label: 'Ink Darkness', min: 0, max: 1, step: 0.05, default: 0 },
  { key: 'paperTone', label: 'Paper Tone', min: 0.7, max: 1, step: 0.01, default: 0.95 },
];

export function apply(model) {
  if (!model) return;

  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable sketch post-process pass
  EventBus.emit('postprocess:enable', 'sketch', {
    clearColor: 0xf2ede3
  });
}
