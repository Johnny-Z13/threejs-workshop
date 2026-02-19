/**
 * Standard PBR material mode
 */
export const id = 'standard';
export const name = 'Standard';
export const key = null; // No key, Cinematic takes key 1
export const category = 'material';
export const uiPosition = 2;

export const params = [];

export function apply(model) {
  if (!model) return;

  model.traverse((child) => {
    if (child.isMesh && child.userData.originalMaterial) {
      child.material = child.userData.originalMaterial;
    }
  });
}
