import { EventBus } from '../../utils/EventBus.js';

/**
 * ASCII art post-processing mode
 */
export const id = 'ascii';
export const name = 'ASCII';
export const key = '4';
export const category = 'post-process';
export const uiPosition = 5;
export const costTier = 'medium';

export const params = [
  { key: 'cellSize', label: 'Cell Size', min: 4, max: 30, step: 1, default: 8 },
  { key: 'scanlines', label: 'Scanlines', min: 0, max: 1, step: 0.05, default: 0 },
  { key: 'brightness', label: 'Brightness', min: 0.5, max: 2, step: 0.05, default: 1.0 },
  { key: 'colorMix', label: 'Color Mix', min: 0, max: 1, step: 0.05, default: 1.0 },
];

export function apply(model) {
  if (!model) return;

  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable ASCII post-process pass with defaults
  EventBus.emit('postprocess:enable', 'ascii', {
    useSceneColor: 1.0,
    scanlines: 0.0,
    tintColor: [1, 1, 1],
    bgColor: [0.02, 0.02, 0.03],
    cellSize: [8, 14],
    clearColor: 0x020203
  });
}
