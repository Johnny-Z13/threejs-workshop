import { EventBus } from '../../utils/EventBus.js';

export const id = 'crt';
export const name = 'CRT Screen';
export const key = '7';
export const category = 'post-process';
export const uiPosition = 12;
export const costTier = 'light';

export const params = [
  { key: 'curvature', label: 'Curvature', min: 0, max: 10, step: 0.5, default: 3.0 },
  { key: 'scanlineIntensity', label: 'Scanlines', min: 0, max: 0.5, step: 0.01, default: 0.15 },
  { key: 'vignetteIntensity', label: 'Vignette', min: 0, max: 1, step: 0.05, default: 0.3 },
];

export function apply(model) {
  // Reset to original materials
  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });

  // Enable CRT post-processing
  EventBus.emit('postprocess:enable', 'crt', {
    curvature: 3.0,
    scanlineIntensity: 0.15,
    vignetteIntensity: 0.3
  });
}
