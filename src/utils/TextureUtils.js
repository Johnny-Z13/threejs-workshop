import * as THREE from 'three';
import { CONFIG } from '../config.js';

/**
 * Texture generation utilities
 */
export class TextureUtils {
  /**
   * Create matcap texture for clay-like shading
   */
  static createMatcapTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(
      size * 0.4, size * 0.35, 0,
      size * 0.5, size * 0.5, size * 0.5
    );
    gradient.addColorStop(0, '#e8e0d8');
    gradient.addColorStop(0.3, '#a8a0a0');
    gradient.addColorStop(0.7, '#605858');
    gradient.addColorStop(1.0, '#282424');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    return new THREE.CanvasTexture(canvas);
  }

  /**
   * Create font atlas for ASCII shader
   */
  static createFontAtlas() {
    const numChars = CONFIG.ASCII_CHARS.length;
    const canvas = document.createElement('canvas');
    canvas.width = CONFIG.ASCII_CELL_W * numChars;
    canvas.height = CONFIG.ASCII_CELL_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = `${CONFIG.ASCII_CELL_H - 2}px "Courier New", "Courier", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numChars; i++) {
      ctx.fillText(
        CONFIG.ASCII_CHARS[i],
        i * CONFIG.ASCII_CELL_W + CONFIG.ASCII_CELL_W / 2,
        CONFIG.ASCII_CELL_H / 2 + 1
      );
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }
}
