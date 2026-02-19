import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * GLB/GLTF loading helpers
 */
const loader = new GLTFLoader();

export function parseGLB(arrayBuffer) {
  return new Promise((resolve, reject) => {
    loader.parse(arrayBuffer, '', resolve, reject);
  });
}

export function loadGLBFromURL(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject);
  });
}
