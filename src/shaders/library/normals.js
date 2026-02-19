import * as THREE from 'three';

/**
 * Normal visualization mode
 */
export const id = 'normals';
export const name = 'Normals';
export const key = '3';
export const category = 'material';
export const uiPosition = 4;

export const params = [];

export function apply(model) {
  if (!model) return;

  model.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshNormalMaterial();
    }
  });
}
