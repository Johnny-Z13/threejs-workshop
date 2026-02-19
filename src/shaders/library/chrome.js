import * as THREE from 'three';

/**
 * Chrome material — full metallic mirror finish with procedural environment reflections
 */
export const id = 'chrome';
export const name = 'Chrome';
export const category = 'material';
export const uiPosition = 2.5; // between standard and matcap

export const params = [
  { key: 'envMapIntensity', label: 'Reflection', min: 0.5, max: 5, step: 0.1, default: 2.5 },
  { key: 'roughness', label: 'Roughness', min: 0, max: 0.5, step: 0.01, default: 0.02 },
];

let envTexture = null;

function createChromeEnvMap() {
  if (envTexture) return envTexture;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Studio gradient — warm top, cool bottom, bright horizon band
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0.0, '#1a1a2e');   // dark blue top
  gradient.addColorStop(0.2, '#3d3d5c');   // mid blue
  gradient.addColorStop(0.4, '#8888aa');   // light steel
  gradient.addColorStop(0.48, '#ffffff');   // bright horizon
  gradient.addColorStop(0.52, '#ffffff');   // bright horizon
  gradient.addColorStop(0.6, '#aa8866');   // warm ground
  gradient.addColorStop(0.8, '#554433');   // dark warm
  gradient.addColorStop(1.0, '#221a11');   // dark floor

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Add some variation — vertical highlight strips
  for (let i = 0; i < 6; i++) {
    const x = size * (0.1 + i * 0.15);
    const stripGrad = ctx.createLinearGradient(x - 10, 0, x + 10, 0);
    stripGrad.addColorStop(0, 'rgba(255,255,255,0)');
    stripGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    stripGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = stripGrad;
    ctx.fillRect(x - 10, 0, 20, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;

  envTexture = texture;
  return envTexture;
}

export function apply(model) {
  if (!model) return;

  const envMap = createChromeEnvMap();

  model.traverse((child) => {
    if (child.isMesh) {
      const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.02,
        envMap: envMap,
        envMapIntensity: 2.5,
      });
      child.material = chromeMat;
    }
  });
}
