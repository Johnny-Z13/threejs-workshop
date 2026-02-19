import * as THREE from 'three';
import { TextureUtils } from '../../utils/TextureUtils.js';

/**
 * Matcap (clay-like) material mode
 */
export const id = 'matcap';
export const name = 'Matcap';
export const key = '2';
export const category = 'material';
export const uiPosition = 3;

export const params = [];

let matcapTexture = null;

export function apply(model) {
  if (!model) return;

  if (!matcapTexture) {
    matcapTexture = TextureUtils.createMatcapTexture();
  }

  model.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshMatcapMaterial({
        matcap: matcapTexture
      });
    }
  });
}
