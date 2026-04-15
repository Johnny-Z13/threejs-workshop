import { EventBus } from '../../utils/EventBus.js';

/**
 * ANDY — high-contrast monochrome posterised look.
 * 4-tone greyscale (black, dark grey, light grey, white) with bold
 * directional lighting and optional thin silhouette edge.
 * Designed for a minimal, graphic, contemporary aesthetic.
 */
export const id = 'andy';
export const name = 'ANDY';
export const category = 'post-process';
export const uiPosition = 24;
export const costTier = 'medium';

export const params = [
  { key: 'toneLevels',    label: 'Tone Levels',    min: 2,   max: 8,   step: 1,    default: 4 },
  { key: 'contrast',      label: 'Contrast',       min: 0.5, max: 3.0, step: 0.05, default: 1.4 },
  { key: 'brightness',    label: 'Brightness',     min: -0.5, max: 0.5, step: 0.01, default: 0.05 },
  { key: 'edgeStrength',  label: 'Edge Stroke',    min: 0,   max: 1.0, step: 0.05, default: 0.3 },
  { key: 'edgeThreshold', label: 'Edge Threshold', min: 0.02, max: 0.5, step: 0.01, default: 0.12 },
];

export function apply(model) {
  if (!model) return;

  // Reset to original materials so lighting interacts naturally
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable the posterize mono post-process pass
  EventBus.emit('postprocess:enable', 'andy', {
    toneLevels: 4,
    contrast: 1.4,
    brightness: 0.05,
    edgeStrength: 0.3,
    edgeThreshold: 0.12,
    clearColor: 0x000000
  });
}
